# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import json
from datetime import date
from typing import Any


AI_WORKBENCH_TABLE_KEYS = {
    "product-goals",
    "personal-tasks",
    "scenarios",
    "requirements",
    "functions",
    "iterations",
    "bugs",
    "badcases",
}


class WorkbenchAISuggestionError(ValueError):
    pass


def _json_object(response: str) -> dict[str, Any]:
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise WorkbenchAISuggestionError("AI 没有返回可读取的整理结果")
    try:
        payload = json.loads(text[start : end + 1])
    except json.JSONDecodeError as error:
        raise WorkbenchAISuggestionError("AI 返回的整理结果格式不正确") from error
    if not isinstance(payload, dict):
        raise WorkbenchAISuggestionError("AI 返回的整理结果格式不正确")
    return payload


def _clean_value(field: dict[str, Any], value: Any) -> Any:
    if value in (None, ""):
        return ""
    field_type = field.get("type")
    options = {option.get("name") for option in field.get("options", [])}

    if field_type == 7:
        return value is True or str(value).lower() in {"true", "1", "是", "已完成"}
    if field_type == 5:
        normalized = str(value)[:10]
        try:
            date.fromisoformat(normalized)
        except ValueError:
            return ""
        return normalized
    if field.get("multiple"):
        raw_values = value if isinstance(value, list) else [value]
        cleaned = [str(raw_value).strip()[:255] for raw_value in raw_values if str(raw_value).strip()]
        return [item for item in cleaned if not options or item in options]
    normalized = str(value).strip()
    if options and normalized not in options:
        return ""
    return normalized[:6000]


def parse_workbench_ai_suggestion(response: str, tables: list[dict[str, Any]]) -> dict[str, Any]:
    payload = _json_object(response)
    table_map = {table["key"]: table for table in tables if table["key"] in AI_WORKBENCH_TABLE_KEYS}
    table_key = str(payload.get("table_key") or "")
    table = table_map.get(table_key)
    if table is None:
        raise WorkbenchAISuggestionError("AI 没有选择有效的工作台位置")

    field_map = {field["id"]: field for field in table["fields"] if not field.get("readonly")}
    raw_values = payload.get("values")
    if not isinstance(raw_values, dict):
        raw_values = {}
    values = {
        field_id: _clean_value(field_map[field_id], value)
        for field_id, value in raw_values.items()
        if field_id in field_map
    }
    primary_field_id = table["primary_field_id"]
    if not values.get(primary_field_id):
        title = str(payload.get("title") or "").strip()[:255]
        if title:
            values[primary_field_id] = title

    try:
        confidence = min(max(float(payload.get("confidence", 0.7)), 0), 1)
    except (TypeError, ValueError):
        confidence = 0.7
    return {
        "table_key": table_key,
        "reason": str(payload.get("reason") or "").strip()[:500],
        "confidence": confidence,
        "values": values,
    }


def local_workbench_suggestion(text: str, tables: list[dict[str, Any]]) -> dict[str, Any]:
    normalized = text.lower()
    rules = [
        ("bugs", ["bug", "报错", "崩溃", "打不开", "故障", "异常", "失效"]),
        ("badcases", ["答非所问", "幻觉", "回答质量", "回答不", "回复不", "ai 回答", "模型回答"]),
        ("iterations", ["研发任务", "开发任务", "联调", "提测", "技术任务", "拆成任务"]),
        ("product-goals", ["季度目标", "月度目标", "阶段目标", "产品目标", "目标是"]),
        ("scenarios", ["用户反馈", "访谈", "用户说", "观察到", "使用场景", "痛点"]),
        ("functions", ["已有功能", "功能清单", "产品结构", "功能模块"]),
        ("personal-tasks", ["提醒我", "我的待办", "个人任务", "今天要", "明天要"]),
    ]
    table_key = "requirements"
    matched_keyword = "产品需求"
    for candidate, keywords in rules:
        keyword = next((keyword for keyword in keywords if keyword in normalized), None)
        if keyword:
            table_key = candidate
            matched_keyword = keyword
            break

    table_map = {table["key"]: table for table in tables}
    table = table_map.get(table_key) or table_map["requirements"]
    primary_field_id = table["primary_field_id"]
    title = text.strip().split("\n", 1)[0].strip(" ，。；;：:")[:80]
    values: dict[str, Any] = {primary_field_id: title}
    detail_names = {"任务详细描述", "场景描述+痛点", "描述", "备注", "问题描述"}
    detail_field = next((field for field in table["fields"] if field["name"] in detail_names), None)
    if detail_field and detail_field["id"] != primary_field_id:
        values[detail_field["id"]] = text.strip()

    return {
        "table_key": table["key"],
        "reason": f"本机根据“{matched_keyword}”判断，建议先放入“{table['name']}”",
        "confidence": 0.55,
        "values": values,
    }
