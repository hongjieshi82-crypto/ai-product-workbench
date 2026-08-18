# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from datetime import date
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.app.views.external.base import get_llm_config, get_llm_response
from plane.db.models import Issue, IssueType, PersonalWorkbenchItem, PersonalWorkbenchTable
from plane.utils.personal_workbench_ai import (
    AI_WORKBENCH_TABLE_KEYS,
    WorkbenchAISuggestionError,
    local_workbench_suggestion,
    parse_workbench_ai_suggestion,
)
from plane.utils.personal_workspace import setup_user_personal_workspace


def _personal_project(user):
    if not user or not user.is_authenticated:
        return None
    return setup_user_personal_workspace(user).project


def _serialize_table(table):
    return {
        "id": str(table.id),
        "key": table.key,
        "name": table.name,
        "sort_order": table.sort_order,
        "primary_field_id": table.primary_field_id,
        "fields": table.fields,
        "views": table.views,
        "item_count": table.items.count(),
    }


def _serialize_item(item):
    return {
        "id": str(item.id),
        "issue_id": str(item.issue_id),
        "issue_identifier": f"{item.project.identifier}-{item.issue.sequence_id}",
        "source_record_id": item.source_record_id,
        "values": item.values,
        "sort_order": item.sort_order,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _serialize_calendar_item(item):
    issue = item.issue
    return {
        "id": str(item.id),
        "issue_id": str(issue.id),
        "title": issue.name,
        "table_key": item.table.key,
        "table_name": item.table.name,
        "start_date": issue.start_date or issue.target_date,
        "end_date": issue.target_date or issue.start_date,
    }


def _clean_values(table, values):
    if not isinstance(values, dict):
        return None
    allowed_fields = {field["id"] for field in table.fields if not field.get("readonly")}
    return {field_id: value for field_id, value in values.items() if field_id in allowed_fields}


def _ai_table_schema(table):
    return {
        "key": table.key,
        "name": table.name,
        "primary_field_id": table.primary_field_id,
        "fields": [
            {
                "id": field["id"],
                "name": field["name"],
                "type": field.get("type"),
                "multiple": field.get("multiple", False),
                "readonly": field.get("readonly", False),
                "options": [{"name": option.get("name")} for option in field.get("options", [])],
            }
            for field in table.fields
        ],
    }


def _date_value(value):
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _sync_issue(item, user):
    table = item.table
    issue = item.issue
    title = item.values.get(table.primary_field_id)
    if isinstance(title, list):
        title = "、".join(str(value) for value in title)
    if title:
        issue.name = str(title)[:255]

    for field in table.fields:
        value = item.values.get(field["id"])
        if field["name"].startswith("优先级"):
            issue.priority = {
                "P0": "urgent",
                "P1": "high",
                "P2": "medium",
                "P3": "low",
            }.get(value, issue.priority)
        elif field["name"] in {"开始时间", "开始日期"}:
            issue.start_date = _date_value(value)
        elif field["name"] in {"结束时间", "截止日期"}:
            issue.target_date = _date_value(value)
    issue.updated_by = user
    issue.save()


class PersonalWorkbenchEndpoint(BaseAPIView):
    def get(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        tables = PersonalWorkbenchTable.objects.filter(project=project).prefetch_related("items")
        return Response(
            {
                "workspace_slug": project.workspace.slug,
                "project_id": str(project.id),
                "project_name": project.name,
                "tables": [_serialize_table(table) for table in tables],
            },
            status=status.HTTP_200_OK,
        )


class PersonalWorkbenchCalendarEndpoint(BaseAPIView):
    def get(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        items = (
            PersonalWorkbenchItem.objects.filter(project=project)
            .filter(issue__start_date__isnull=False)
            .select_related("issue", "table")
            .order_by("issue__start_date", "issue__target_date")
        )
        items_without_start = (
            PersonalWorkbenchItem.objects.filter(
                project=project,
                issue__start_date__isnull=True,
                issue__target_date__isnull=False,
            )
            .select_related("issue", "table")
            .order_by("issue__target_date")
        )
        return Response(
            [_serialize_calendar_item(item) for item in [*items, *items_without_start]],
            status=status.HTTP_200_OK,
        )


class PersonalWorkbenchFieldOptionsEndpoint(BaseAPIView):
    @transaction.atomic
    def patch(self, request, table_id, field_id):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        table = PersonalWorkbenchTable.objects.filter(id=table_id, project=project).first()
        if table is None:
            return Response({"error": "工作台表格不存在"}, status=status.HTTP_404_NOT_FOUND)

        field_index = next((index for index, field in enumerate(table.fields) if field["id"] == field_id), None)
        if field_index is None:
            return Response({"error": "字段不存在"}, status=status.HTTP_404_NOT_FOUND)
        field = table.fields[field_index]
        if field.get("type") not in {3, 4} and not field.get("options"):
            return Response({"error": "这个字段不是下拉选项"}, status=status.HTTP_400_BAD_REQUEST)

        raw_options = request.data.get("options")
        if not isinstance(raw_options, list):
            return Response({"error": "选项格式不正确"}, status=status.HTTP_400_BAD_REQUEST)
        options = []
        option_names = set()
        for raw_option in raw_options:
            if not isinstance(raw_option, dict):
                return Response({"error": "选项格式不正确"}, status=status.HTTP_400_BAD_REQUEST)
            name = str(raw_option.get("name") or "").strip()[:100]
            normalized_name = name.casefold()
            if not name:
                return Response({"error": "选项名称不能为空"}, status=status.HTTP_400_BAD_REQUEST)
            if normalized_name in option_names:
                return Response({"error": "选项名称不能重复"}, status=status.HTTP_400_BAD_REQUEST)
            option_names.add(normalized_name)
            options.append(
                {
                    "id": str(raw_option.get("id") or uuid4()),
                    "name": name,
                    "color": raw_option.get("color"),
                }
            )

        fields = [dict(current_field) for current_field in table.fields]
        fields[field_index]["options"] = options
        table.fields = fields
        table.updated_by = request.user
        table.save(update_fields=["fields", "updated_by", "updated_at"])
        return Response(_serialize_table(table), status=status.HTTP_200_OK)


class PersonalWorkbenchAISuggestionEndpoint(BaseAPIView):
    def post(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        text = str(request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "请先输入要整理的内容"}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 6000:
            return Response({"error": "单次输入不能超过 6000 个字"}, status=status.HTTP_400_BAD_REQUEST)

        table_models = list(
            PersonalWorkbenchTable.objects.filter(project=project, key__in=AI_WORKBENCH_TABLE_KEYS).order_by(
                "sort_order"
            )
        )
        tables = [_ai_table_schema(table) for table in table_models]
        fallback = local_workbench_suggestion(text, tables)
        api_key, model, provider = get_llm_config()
        if not api_key or not model or not provider:
            return Response(
                {
                    **fallback,
                    "mode": "local",
                    "source_text": text,
                    "notice": "尚未连接 AI 服务，当前使用本机初步识别",
                },
                status=status.HTTP_200_OK,
            )

        task = (
            "你是一名谨慎的中文产品经理。判断用户输入最适合放入哪一张个人产品工作台表格，并按照该表已有字段预填。"
            "不得创建表格之外的字段，不得编造负责人、日期、优先级、版本或用户没有提供的事实。"
            "下拉字段只能使用提供的选项，不确定的字段留空。只返回 JSON，不要返回 Markdown。"
            "JSON 必须包含 table_key、title、reason、confidence 和 values；values 的键必须是所选表格的字段 ID。"
        )
        prompt = json.dumps(
            {"today": date.today().isoformat(), "user_input": text, "available_tables": tables},
            ensure_ascii=False,
        )
        response_text, error = get_llm_response(task, prompt, api_key, model, provider)
        if response_text:
            try:
                suggestion = parse_workbench_ai_suggestion(response_text, tables)
                return Response(
                    {**suggestion, "mode": "ai", "source_text": text, "notice": ""},
                    status=status.HTTP_200_OK,
                )
            except WorkbenchAISuggestionError as parse_error:
                error = str(parse_error)

        return Response(
            {
                **fallback,
                "mode": "local",
                "source_text": text,
                "notice": f"AI 暂时没有返回可用结果，已改用本机初步识别：{error or '未知错误'}",
            },
            status=status.HTTP_200_OK,
        )


class PersonalWorkbenchItemEndpoint(BaseAPIView):
    def get(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        section = request.GET.get("section", "")
        table = PersonalWorkbenchTable.objects.filter(project=project, key=section).first()
        if table is None:
            return Response({"error": "工作台表格不存在"}, status=status.HTTP_404_NOT_FOUND)
        items = PersonalWorkbenchItem.objects.filter(table=table).select_related("issue", "project")
        return Response([_serialize_item(item) for item in items], status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        section = request.data.get("section", "")
        table = PersonalWorkbenchTable.objects.filter(project=project, key=section).first()
        if table is None:
            return Response({"error": "工作台表格不存在"}, status=status.HTTP_404_NOT_FOUND)
        values = _clean_values(table, request.data.get("values", {}))
        if values is None:
            return Response({"error": "事项内容格式不正确"}, status=status.HTTP_400_BAD_REQUEST)

        issue_type = IssueType.objects.filter(
            workspace=project.workspace,
            external_source="personal_workbench",
            external_id=section,
        ).first()
        title = values.get(table.primary_field_id) or "未命名事项"
        if isinstance(title, list):
            title = "、".join(str(value) for value in title)
        issue = Issue.objects.create(
            project=project,
            workspace=project.workspace,
            name=str(title)[:255],
            type=issue_type,
            external_source="personal_workbench",
            created_by=request.user,
        )
        last_sort_order = (
            PersonalWorkbenchItem.objects.filter(table=table)
            .order_by("-sort_order")
            .values_list("sort_order", flat=True)
            .first()
        )
        item = PersonalWorkbenchItem.objects.create(
            project=project,
            workspace=project.workspace,
            table=table,
            issue=issue,
            values=values,
            source_values={
                "ai_original_input": str(request.data.get("source_text") or "").strip()[:6000]
            }
            if request.data.get("source_text")
            else {},
            sort_order=(last_sort_order or 0) + 1000,
            created_by=request.user,
        )
        _sync_issue(item, request.user)
        return Response(_serialize_item(item), status=status.HTTP_201_CREATED)


class PersonalWorkbenchItemReorderEndpoint(BaseAPIView):
    @transaction.atomic
    def patch(self, request):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)

        section = request.data.get("section", "")
        table = PersonalWorkbenchTable.objects.filter(project=project, key=section).first()
        if table is None:
            return Response({"error": "工作台表格不存在"}, status=status.HTTP_404_NOT_FOUND)

        item_ids = request.data.get("item_ids")
        if not isinstance(item_ids, list) or not all(isinstance(item_id, str) for item_id in item_ids):
            return Response({"error": "事项顺序格式不正确"}, status=status.HTTP_400_BAD_REQUEST)
        if len(item_ids) != len(set(item_ids)):
            return Response({"error": "事项顺序中不能有重复项"}, status=status.HTTP_400_BAD_REQUEST)

        items = list(PersonalWorkbenchItem.objects.select_for_update().filter(table=table))
        item_map = {str(item.id): item for item in items}
        if set(item_ids) != set(item_map):
            return Response({"error": "请提交这张表中的全部事项"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        reordered_items = []
        for index, item_id in enumerate(item_ids):
            item = item_map[item_id]
            item.sort_order = (index + 1) * 1000
            item.updated_by = request.user
            item.updated_at = now
            reordered_items.append(item)
        PersonalWorkbenchItem.objects.bulk_update(
            reordered_items,
            ["sort_order", "updated_by", "updated_at"],
        )
        return Response([_serialize_item(item) for item in reordered_items], status=status.HTTP_200_OK)


class PersonalWorkbenchItemDetailEndpoint(BaseAPIView):
    @transaction.atomic
    def patch(self, request, item_id):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        item = (
            PersonalWorkbenchItem.objects.select_related("table", "issue", "project")
            .filter(id=item_id, project=project)
            .first()
        )
        if item is None:
            return Response({"error": "事项不存在"}, status=status.HTTP_404_NOT_FOUND)
        values = _clean_values(item.table, request.data.get("values", {}))
        if values is None:
            return Response({"error": "事项内容格式不正确"}, status=status.HTTP_400_BAD_REQUEST)
        item.values = {**item.values, **values}
        item.updated_by = request.user
        item.save(update_fields=["values", "updated_by", "updated_at"])
        _sync_issue(item, request.user)
        return Response(_serialize_item(item), status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, item_id):
        project = _personal_project(request.user)
        if project is None:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)
        item = PersonalWorkbenchItem.objects.select_related("issue").filter(id=item_id, project=project).first()
        if item is None:
            return Response({"error": "事项不存在"}, status=status.HTTP_404_NOT_FOUND)
        issue = item.issue
        item.delete()
        issue.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
