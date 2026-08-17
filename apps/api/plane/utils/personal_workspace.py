# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from dataclasses import dataclass
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http.request import split_domain_port

from plane.db.models import (
    IssueType,
    PersonalWorkbenchTable,
    Profile,
    Project,
    ProjectIdentifier,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.issue_type import ProjectIssueType
from plane.license.models import Instance, InstanceAdmin
from plane.utils.personal_workbench_template import get_personal_workbench_template


PERSONAL_PROJECT_STATES = [
    {
        "name": "待处理",
        "color": "#60646C",
        "sequence": 15000,
        "group": "backlog",
        "default": True,
    },
    {"name": "未开始", "color": "#60646C", "sequence": 25000, "group": "unstarted"},
    {"name": "进行中", "color": "#F59E0B", "sequence": 35000, "group": "started"},
    {"name": "已完成", "color": "#46A758", "sequence": 45000, "group": "completed"},
    {"name": "已取消", "color": "#9AA4BC", "sequence": 55000, "group": "cancelled"},
    {"name": "待评估", "color": "#4E5355", "sequence": 65000, "group": "triage"},
]


@dataclass(frozen=True)
class PersonalWorkspaceSetup:
    user: User
    workspace: Workspace
    project: Project


def is_workbench_dev_login_enabled(request):
    if not settings.DEBUG or not settings.WORKBENCH_DEV_LOGIN_CODE:
        return False
    host, _ = split_domain_port(request.get_host())
    return host in settings.PERSONAL_WORKSPACE_ALLOWED_HOSTS


def get_personal_user():
    admin = (
        InstanceAdmin.objects.select_related("user")
        .filter(user__is_active=True, user__is_bot=False)
        .order_by("created_at")
        .first()
    )
    if admin:
        return admin.user

    personal_email = settings.PERSONAL_WORKSPACE_EMAIL.strip().lower()
    user = User.objects.filter(email=personal_email, is_active=True).first()
    if user:
        return user

    return User.objects.filter(is_active=True, is_bot=False).order_by("created_at").first()


def _available_workspace_slug():
    base_slug = "personal-workbench"
    slug = base_slug
    suffix = 2
    while Workspace.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{suffix}"
        suffix += 1
    return slug


def _existing_personal_project(user):
    membership = (
        ProjectMember.objects.select_related("project", "project__workspace")
        .filter(
            member=user,
            is_active=True,
            project__external_source="personal_workbench",
            project__external_id=str(user.id),
        )
        .order_by("created_at")
        .first()
    )
    if membership:
        return membership.project

    # Preserve the original local workbench, which predates the project marker.
    membership = (
        ProjectMember.objects.select_related("project", "project__workspace")
        .filter(
            Q(project__project_lead=user) | Q(project__workspace__owner=user),
            member=user,
            is_active=True,
            project__project_personalworkbenchtable__isnull=False,
        )
        .order_by("created_at")
        .first()
    )
    if membership:
        project = membership.project
        project.external_source = "personal_workbench"
        project.external_id = str(user.id)
        project.save(update_fields=["external_source", "external_id", "updated_at"])
        return project
    return None


def _create_personal_project(user):
    workspace = Workspace.objects.create(
        name="个人工作台",
        slug=_available_workspace_slug(),
        owner=user,
        timezone="Asia/Shanghai",
        created_by=user,
    )
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=20, created_by=user)
    project = Project.objects.create(
        name="个人产品",
        identifier="PM",
        description="",
        network=0,
        workspace=workspace,
        project_lead=user,
        timezone="Asia/Shanghai",
        external_source="personal_workbench",
        external_id=str(user.id),
        is_issue_type_enabled=True,
        created_by=user,
    )
    ProjectIdentifier.objects.create(
        name=project.identifier,
        project=project,
        workspace=workspace,
        created_by=user,
    )
    State.objects.bulk_create(
        [
            State(
                name=state["name"],
                color=state["color"],
                project=project,
                workspace=workspace,
                sequence=state["sequence"],
                group=state["group"],
                default=state.get("default", False),
                created_by=user,
            )
            for state in PERSONAL_PROJECT_STATES
        ]
    )
    ProjectMember.objects.create(project=project, member=user, role=20, created_by=user)
    return project


def _ensure_workbench_tables(project, user):
    for table_data in get_personal_workbench_template():
        issue_type, _ = IssueType.objects.get_or_create(
            workspace=project.workspace,
            external_source="personal_workbench",
            external_id=table_data["key"],
            defaults={
                "name": table_data["name"],
                "description": "个人产品工作台事项类型",
                "is_active": True,
                "created_by": user,
            },
        )
        ProjectIssueType.objects.get_or_create(
            project=project,
            issue_type=issue_type,
            defaults={"level": table_data["sort_order"], "created_by": user},
        )
        PersonalWorkbenchTable.objects.get_or_create(
            project=project,
            key=table_data["key"],
            defaults={
                "workspace": project.workspace,
                "name": table_data["name"],
                "source_table_id": table_data["source_table_id"],
                "sort_order": table_data["sort_order"],
                "primary_field_id": table_data["primary_field_id"],
                "fields": table_data["fields"],
                "views": table_data["views"],
                "source_schema": table_data["source_schema"],
                "created_by": user,
            },
        )


@transaction.atomic
def setup_user_personal_workspace(
    user: User,
    *,
    reuse_existing_project: bool = False,
    ensure_tables: bool = True,
) -> PersonalWorkspaceSetup:
    profile, _ = Profile.objects.get_or_create(user=user)
    project = _existing_personal_project(user)
    if project is None and reuse_existing_project:
        membership = (
            ProjectMember.objects.select_related("project", "project__workspace")
            .filter(member=user, is_active=True)
            .order_by("created_at")
            .first()
        )
        if membership:
            project = membership.project
            project.external_source = "personal_workbench"
            project.external_id = str(user.id)
            project.save(update_fields=["external_source", "external_id", "updated_at"])
    project = project or _create_personal_project(user)
    workspace = project.workspace
    if ensure_tables:
        _ensure_workbench_tables(project, user)

    profile.is_onboarded = True
    profile.is_tour_completed = True
    profile.is_navigation_tour_completed = True
    profile.language = "zh-CN"
    profile.onboarding_step = {
        "profile_complete": True,
        "workspace_create": True,
        "workspace_invite": True,
        "workspace_join": True,
    }
    profile.last_workspace_id = workspace.id
    profile.save(
        update_fields=[
            "is_onboarded",
            "is_tour_completed",
            "is_navigation_tour_completed",
            "language",
            "onboarding_step",
            "last_workspace_id",
            "updated_at",
        ]
    )

    return PersonalWorkspaceSetup(user=user, workspace=workspace, project=project)


@transaction.atomic
def setup_personal_workspace(instance: Instance) -> PersonalWorkspaceSetup:
    user = get_personal_user()
    if user is None:
        user = User(
            email=settings.PERSONAL_WORKSPACE_EMAIL.strip().lower(),
            username=uuid4().hex,
            display_name="我的工作台",
            first_name="我",
            is_active=True,
            is_email_verified=True,
            is_email_valid=True,
            user_timezone="Asia/Shanghai",
        )
        user.set_unusable_password()
        user.save()

    result = setup_user_personal_workspace(
        user,
        reuse_existing_project=True,
        ensure_tables=False,
    )
    InstanceAdmin.objects.get_or_create(
        instance=instance,
        user=user,
        defaults={"role": 20, "is_verified": True, "created_by": user},
    )

    if not instance.is_setup_done:
        instance.instance_name = "个人工作台"
        instance.is_setup_done = True
        instance.is_signup_screen_visited = True
        instance.is_telemetry_enabled = False
        instance.is_support_required = False
        instance.save(
            update_fields=[
                "instance_name",
                "is_setup_done",
                "is_signup_screen_visited",
                "is_telemetry_enabled",
                "is_support_required",
                "updated_at",
            ]
        )

    return result
