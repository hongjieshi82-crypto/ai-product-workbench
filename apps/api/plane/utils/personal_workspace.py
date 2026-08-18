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

PERSONAL_WORKBENCH_FIELD_RENAMES = {
    ("requirements", "需求目标"): "建设方向/目标",
}


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
        table, created = PersonalWorkbenchTable.objects.get_or_create(
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
        if created:
            continue

        # Product updates may add fields or views. Merge only missing definitions so
        # existing records, edited options, and imported schema remain untouched.
        fields = [dict(field) for field in (table.fields or [])]
        for field in fields:
            renamed_field = PERSONAL_WORKBENCH_FIELD_RENAMES.get((table_data["key"], field.get("name")))
            if renamed_field:
                field["name"] = renamed_field
        template_to_actual_field_ids = {}
        added_field_ids = []
        for template_index, field in enumerate(table_data["fields"]):
            existing_field = next(
                (
                    existing_field
                    for existing_field in fields
                    if existing_field.get("id") == field["id"] or existing_field.get("name") == field["name"]
                ),
                None,
            )
            if existing_field:
                template_to_actual_field_ids[field["id"]] = existing_field["id"]
                continue
            insert_at = len(fields)
            for previous_field in reversed(table_data["fields"][:template_index]):
                previous_actual_id = template_to_actual_field_ids.get(previous_field["id"])
                previous_index = next(
                    (
                        index
                        for index, existing_field in enumerate(fields)
                        if existing_field.get("id") == previous_actual_id
                    ),
                    None,
                )
                if previous_index is not None:
                    insert_at = previous_index + 1
                    break
            fields.insert(insert_at, field)
            template_to_actual_field_ids[field["id"]] = field["id"]
            added_field_ids.append(field["id"])

        if table_data["key"] == "requirements":
            requirement_front_ids = [
                template_to_actual_field_ids[field_id]
                for field_id in [
                    "requirement-title",
                    "requirement-goal",
                    "requirement-source",
                    "requirement-description",
                ]
            ]
            fields_by_id = {field["id"]: field for field in fields}
            fields = [fields_by_id[field_id] for field_id in requirement_front_ids] + [
                field for field in fields if field["id"] not in requirement_front_ids
            ]

        views = [dict(view) for view in (table.views or [])]
        existing_view_ids = {view.get("id") for view in views}
        existing_view_names = {view.get("name") for view in views}
        for view in table_data["views"]:
            if view["id"] in existing_view_ids or view["name"] in existing_view_names:
                continue
            views.append(view)
            existing_view_ids.add(view["id"])
            existing_view_names.add(view["name"])

        if added_field_ids:
            for view in views:
                view_fields = list(view.get("fields") or [])
                if view.get("type") == 8:
                    continue
                for field_id in added_field_ids:
                    if field_id not in view_fields:
                        template_view = next(
                            (
                                template_view
                                for template_view in table_data["views"]
                                if template_view["id"] == view.get("id") or template_view["name"] == view.get("name")
                            ),
                            None,
                        )
                        template_fields = (
                            [
                                template_to_actual_field_ids.get(template_field_id, template_field_id)
                                for template_field_id in template_view.get("fields", [])
                            ]
                            if template_view
                            else []
                        )
                        template_index = (
                            template_fields.index(field_id) if field_id in template_fields else len(template_fields)
                        )
                        insert_at = len(view_fields)
                        for previous_field_id in reversed(template_fields[:template_index]):
                            if previous_field_id in view_fields:
                                insert_at = view_fields.index(previous_field_id) + 1
                                break
                        view_fields.insert(insert_at, field_id)
                view["fields"] = view_fields

        if table_data["key"] == "requirements":
            requirement_front_ids = [
                template_to_actual_field_ids[field_id]
                for field_id in [
                    "requirement-title",
                    "requirement-goal",
                    "requirement-source",
                    "requirement-description",
                ]
            ]
            for view in views:
                view_fields = list(view.get("fields") or [])
                visible_front_ids = [field_id for field_id in requirement_front_ids if field_id in view_fields]
                view["fields"] = visible_front_ids + [
                    field_id for field_id in view_fields if field_id not in visible_front_ids
                ]

        update_fields = []
        if fields != table.fields:
            table.fields = fields
            update_fields.append("fields")
        if views != table.views:
            table.views = views
            update_fields.append("views")
        if update_fields:
            table.updated_by = user
            table.save(update_fields=[*update_fields, "updated_by", "updated_at"])


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
