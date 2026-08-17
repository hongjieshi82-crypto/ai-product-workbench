# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, override_settings
from django.utils import timezone

from plane.db.models import (
    PersonalWorkbenchItem,
    PersonalWorkbenchTable,
    Profile,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.license.models import Instance, InstanceAdmin
from plane.middleware.personal_workspace import PersonalWorkspaceMiddleware
from plane.utils.personal_workspace import (
    is_workbench_dev_login_enabled,
    setup_personal_workspace,
    setup_user_personal_workspace,
)


def _instance():
    return Instance.objects.create(
        instance_name="Plane",
        instance_id=uuid4().hex,
        current_version="test",
        last_checked_at=timezone.now(),
    )


@pytest.mark.unit
@pytest.mark.django_db
@override_settings(PERSONAL_WORKSPACE_EMAIL="personal@plane.local")
def test_setup_personal_workspace_is_idempotent_and_ready_to_use():
    instance = _instance()

    first = setup_personal_workspace(instance)
    second = setup_personal_workspace(instance)

    instance.refresh_from_db()
    first.user.refresh_from_db()
    profile = Profile.objects.get(user=first.user)
    assert first == second
    assert instance.is_setup_done is True
    assert instance.is_telemetry_enabled is False
    assert first.user.has_usable_password() is False
    assert profile.is_onboarded is True
    assert profile.language == "zh-CN"
    assert profile.last_workspace_id == first.workspace.id
    assert set(State.all_state_objects.filter(project=first.project).values_list("name", flat=True)) == {
        "待处理",
        "未开始",
        "进行中",
        "已完成",
        "已取消",
        "待评估",
    }
    assert Workspace.objects.count() == 1
    assert Project.objects.count() == 1
    assert WorkspaceMember.objects.filter(workspace=first.workspace, member=first.user, role=20).exists()
    assert ProjectMember.objects.filter(project=first.project, member=first.user, role=20).exists()
    assert InstanceAdmin.objects.filter(instance=instance, user=first.user).exists()


@pytest.mark.unit
@pytest.mark.django_db
@override_settings(PERSONAL_WORKSPACE_EMAIL="personal@plane.local")
def test_setup_personal_workspace_preserves_existing_user_workspace_and_project():
    instance = _instance()
    user = User.objects.create(email="existing@example.com", username="existing-user")
    workspace = Workspace.objects.create(name="已有空间", slug="existing", owner=user)
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=20)
    project = Project.objects.create(name="已有产品", identifier="OLD", workspace=workspace)
    ProjectMember.objects.create(project=project, member=user, role=20)

    result = setup_personal_workspace(instance)

    assert result.user == user
    assert result.workspace == workspace
    assert result.project == project
    assert User.objects.count() == 1
    assert Workspace.objects.count() == 1
    assert Project.objects.count() == 1


@pytest.mark.unit
@pytest.mark.django_db
def test_each_user_gets_an_empty_isolated_workbench_without_admin_access():
    first_user = User.objects.create(email="first@example.com", username="first-user")
    second_user = User.objects.create(email="second@example.com", username="second-user")

    first = setup_user_personal_workspace(first_user)
    second = setup_user_personal_workspace(second_user)

    assert first.workspace != second.workspace
    assert first.project != second.project
    assert first.workspace.owner == first_user
    assert second.workspace.owner == second_user
    assert PersonalWorkbenchTable.objects.filter(project=first.project).count() == 9
    assert PersonalWorkbenchTable.objects.filter(project=second.project).count() == 9
    assert PersonalWorkbenchItem.objects.filter(project__in=[first.project, second.project]).count() == 0
    assert not InstanceAdmin.objects.filter(user__in=[first_user, second_user]).exists()


@pytest.mark.unit
@pytest.mark.django_db
def test_existing_workbench_only_receives_missing_timeline_schema():
    user = User.objects.create(email="timeline@example.com", username="timeline-user")
    result = setup_user_personal_workspace(user)
    table = PersonalWorkbenchTable.objects.get(project=result.project, key="iterations")
    table.fields = [field for field in table.fields if field["id"] != "iteration-start"]
    table.views = [view for view in table.views if view["type"] != 8]
    status_field = next(field for field in table.fields if field["id"] == "iteration-status")
    status_field["options"] = [{"id": "custom", "name": "我自己的状态", "color": 2}]
    table.save(update_fields=["fields", "views", "updated_at"])

    setup_user_personal_workspace(user)

    table.refresh_from_db()
    assert any(field["id"] == "iteration-start" for field in table.fields)
    assert any(view["type"] == 8 and view["name"] == "时间轴" for view in table.views)
    status_field = next(field for field in table.fields if field["id"] == "iteration-status")
    assert status_field["options"] == [{"id": "custom", "name": "我自己的状态", "color": 2}]


@pytest.mark.unit
@pytest.mark.django_db
@override_settings(
    PERSONAL_WORKSPACE_EMAIL="personal@plane.local",
    PERSONAL_WORKSPACE_ALLOWED_HOSTS={"localhost", "127.0.0.1", "::1"},
)
def test_personal_workspace_middleware_logs_in_only_on_localhost():
    instance = _instance()
    result = setup_personal_workspace(instance)
    middleware = PersonalWorkspaceMiddleware(lambda request: request)

    local_request = RequestFactory().get("/api/users/me/", HTTP_HOST="localhost:8000")
    SessionMiddleware(lambda request: request).process_request(local_request)
    local_request.user = AnonymousUser()
    middleware(local_request)

    remote_request = RequestFactory().get("/api/users/me/", HTTP_HOST="192.168.1.20:8000")
    SessionMiddleware(lambda request: request).process_request(remote_request)
    remote_request.user = AnonymousUser()
    middleware(remote_request)

    assert local_request.user == result.user
    assert remote_request.user.is_anonymous


@pytest.mark.unit
@override_settings(
    DEBUG=False,
    WORKBENCH_DEV_LOGIN_CODE=True,
    PERSONAL_WORKSPACE_ALLOWED_HOSTS={"localhost"},
)
def test_development_login_code_is_never_enabled_in_production():
    request = RequestFactory().get("/auth/magic-generate/", HTTP_HOST="localhost:8000")

    assert is_workbench_dev_login_enabled(request) is False
