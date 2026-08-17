# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, override_settings
from django.utils import timezone

from plane.db.models import Profile, Project, ProjectMember, State, User, Workspace, WorkspaceMember
from plane.license.models import Instance, InstanceAdmin
from plane.middleware.personal_workspace import PersonalWorkspaceMiddleware
from plane.utils.personal_workspace import setup_personal_workspace


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
