# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date
from uuid import uuid4

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from plane.app.views.personal_workbench import (
    PersonalWorkbenchCalendarEndpoint,
    PersonalWorkbenchFieldOptionsEndpoint,
    PersonalWorkbenchItemEndpoint,
    PersonalWorkbenchItemDetailEndpoint,
    PersonalWorkbenchItemReorderEndpoint,
)
from plane.db.models import Issue, PersonalWorkbenchItem, PersonalWorkbenchTable, User
from plane.license.models import Instance
from plane.utils.personal_workspace import setup_personal_workspace, setup_user_personal_workspace


def _personal_workspace():
    instance = Instance.objects.create(
        instance_name="Plane",
        instance_id=uuid4().hex,
        current_version="test",
        last_checked_at=timezone.now(),
    )
    return setup_personal_workspace(instance)


def _create_item(result, table, *, imported=False, start_date=None, target_date=None):
    issue = Issue.objects.create(
        project=result.project,
        workspace=result.workspace,
        name="测试排期",
        external_source=f"feishu_base:{table.source_table_id}" if imported else "personal_workbench",
        external_id="rec-source" if imported else None,
        start_date=start_date,
        target_date=target_date,
        created_by=result.user,
    )
    return PersonalWorkbenchItem.objects.create(
        project=result.project,
        workspace=result.workspace,
        table=table,
        issue=issue,
        values={"title": "测试排期"},
        source_values={"title": {"value": "测试排期"}} if imported else {},
        source_record_id="rec-source" if imported else None,
        created_by=result.user,
    )


@pytest.mark.unit
@pytest.mark.django_db
def test_clear_imported_workbench_keeps_personal_items():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="requirements",
        name="需求池",
        source_table_id="source-requirements",
    )
    imported = _create_item(result, table, imported=True)
    personal = _create_item(result, table)

    call_command("clear_imported_personal_workbench")

    assert not PersonalWorkbenchItem.objects.filter(id=imported.id).exists()
    assert PersonalWorkbenchItem.all_objects.filter(id=imported.id, deleted_at__isnull=False).exists()
    assert not Issue.objects.filter(id=imported.issue_id).exists()
    assert PersonalWorkbenchItem.objects.filter(id=personal.id).exists()
    assert Issue.objects.filter(id=personal.issue_id).exists()


@pytest.mark.unit
@pytest.mark.django_db
def test_delete_item_soft_deletes_only_selected_item():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="personal-tasks",
        name="个人任务",
        source_table_id="source-tasks",
    )
    selected = _create_item(result, table)
    retained = _create_item(result, table)
    request = APIRequestFactory().delete(f"/api/personal-workbench/items/{selected.id}/")
    force_authenticate(request, user=result.user)

    response = PersonalWorkbenchItemDetailEndpoint.as_view()(request, item_id=selected.id)

    assert response.status_code == 204
    assert not PersonalWorkbenchItem.objects.filter(id=selected.id).exists()
    assert not Issue.objects.filter(id=selected.issue_id).exists()
    assert PersonalWorkbenchItem.objects.filter(id=retained.id).exists()


@pytest.mark.unit
@pytest.mark.django_db
def test_calendar_returns_scheduled_personal_items():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="iterations",
        name="迭代任务",
        source_table_id="source-iterations",
    )
    scheduled = _create_item(
        result,
        table,
        start_date=date(2026, 8, 10),
        target_date=date(2026, 8, 15),
    )
    _create_item(result, table)
    request = APIRequestFactory().get("/api/personal-workbench/calendar/")
    force_authenticate(request, user=result.user)

    response = PersonalWorkbenchCalendarEndpoint.as_view()(request)

    assert response.status_code == 200
    assert response.data == [
        {
            "id": str(scheduled.id),
            "issue_id": str(scheduled.issue_id),
            "title": "测试排期",
            "table_key": "iterations",
            "table_name": "迭代任务",
            "start_date": date(2026, 8, 10),
            "end_date": date(2026, 8, 15),
        }
    ]


@pytest.mark.unit
@pytest.mark.django_db
def test_update_field_options_preserves_existing_item_values():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="product-goals",
        name="产品目标",
        source_table_id="source-goals",
        fields=[
            {
                "id": "goal",
                "name": "总目标",
                "type": 3,
                "options": [{"id": "old", "name": "旧目标", "color": 1}],
            }
        ],
    )
    item = _create_item(result, table)
    item.values = {"goal": "旧目标"}
    item.save(update_fields=["values", "updated_at"])
    request = APIRequestFactory().patch(
        f"/api/personal-workbench/tables/{table.id}/fields/goal/options/",
        {
            "options": [
                {"id": "new-1", "name": "增长目标", "color": None},
                {"id": "new-2", "name": "体验目标", "color": None},
            ]
        },
        format="json",
    )
    force_authenticate(request, user=result.user)

    response = PersonalWorkbenchFieldOptionsEndpoint.as_view()(request, table_id=table.id, field_id="goal")

    assert response.status_code == 200
    table.refresh_from_db()
    item.refresh_from_db()
    assert [option["name"] for option in table.fields[0]["options"]] == ["增长目标", "体验目标"]
    assert item.values == {"goal": "旧目标"}


@pytest.mark.unit
@pytest.mark.django_db
def test_reorder_items_updates_the_whole_table_order():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="requirements",
        name="需求池",
        source_table_id="source-requirements",
    )
    first = _create_item(result, table)
    second = _create_item(result, table)
    third = _create_item(result, table)
    request = APIRequestFactory().patch(
        "/api/personal-workbench/items/reorder/",
        {
            "section": "requirements",
            "item_ids": [str(third.id), str(first.id), str(second.id)],
        },
        format="json",
    )
    force_authenticate(request, user=result.user)

    response = PersonalWorkbenchItemReorderEndpoint.as_view()(request)

    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [str(third.id), str(first.id), str(second.id)]
    assert list(table.items.values_list("id", flat=True)) == [third.id, first.id, second.id]


@pytest.mark.unit
@pytest.mark.django_db
def test_reorder_items_rejects_an_incomplete_table_order():
    result = _personal_workspace()
    table = PersonalWorkbenchTable.objects.create(
        project=result.project,
        workspace=result.workspace,
        key="requirements",
        name="需求池",
        source_table_id="source-requirements",
    )
    first = _create_item(result, table)
    second = _create_item(result, table)
    request = APIRequestFactory().patch(
        "/api/personal-workbench/items/reorder/",
        {"section": "requirements", "item_ids": [str(second.id)]},
        format="json",
    )
    force_authenticate(request, user=result.user)

    response = PersonalWorkbenchItemReorderEndpoint.as_view()(request)

    assert response.status_code == 400
    assert list(table.items.values_list("id", flat=True)) == [first.id, second.id]


@pytest.mark.unit
@pytest.mark.django_db
def test_workbench_endpoints_never_return_another_users_items():
    first_user = User.objects.create(email="first@example.com", username="first-user")
    second_user = User.objects.create(email="second@example.com", username="second-user")
    first = setup_user_personal_workspace(first_user)
    second = setup_user_personal_workspace(second_user)
    first_table = PersonalWorkbenchTable.objects.get(project=first.project, key="requirements")
    first_item = _create_item(first, first_table)

    list_request = APIRequestFactory().get("/api/personal-workbench/items/?section=requirements")
    force_authenticate(list_request, user=second_user)
    list_response = PersonalWorkbenchItemEndpoint.as_view()(list_request)

    update_request = APIRequestFactory().patch(
        f"/api/personal-workbench/items/{first_item.id}/",
        {first_table.primary_field_id: "不应被修改"},
        format="json",
    )
    force_authenticate(update_request, user=second_user)
    update_response = PersonalWorkbenchItemDetailEndpoint.as_view()(update_request, item_id=first_item.id)

    assert first.project != second.project
    assert list_response.status_code == 200
    assert list_response.data == []
    assert update_response.status_code == 404
    first_item.refresh_from_db()
    assert first_item.values == {"title": "测试排期"}
