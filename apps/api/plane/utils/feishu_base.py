# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TABLE_DEFINITIONS = {
    "tblgFq370WhVVnXc": ("product-goals", "产品目标", 0),
    "tbl2GReEmltImlUS": ("personal-tasks", "个人任务", 1),
    "tbl57o27HP4R1ylt": ("scenarios", "场景挖掘", 2),
    "tblIJSiQxrls5Vql": ("requirements", "需求池", 3),
    "tblMGK20xK1QGpXT": ("functions", "功能清单", 4),
    "tbl0smG9vNXtvOPC": ("iterations", "迭代任务", 5),
    "tblSPa9cYVKuxMxk": ("bugs", "Bug 清单", 6),
    "tbljOJ9w7Tillh14": ("badcases", "Badcase", 7),
    "tblK7lRSH1EO9JXb": ("case-clusters", "Case 聚类分析", 8),
}


def parse_feishu_base(file_path: str) -> list[dict[str, Any]]:
    payload = json.loads(Path(file_path).read_text(encoding="utf-8"))
    snapshot = gzip.decompress(base64.b64decode(payload["gzipSnapshot"])).decode("utf-8")
    entries = json.loads(snapshot)
    if not isinstance(entries, list):
        raise ValueError("Feishu Base snapshot must be a list")
    return entries


def _field_options(field: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"id": option.get("id"), "name": option.get("name", ""), "color": option.get("color")}
        for option in field.get("property", {}).get("options", [])
    ]


def _option_name(field: dict[str, Any], option_id: Any) -> Any:
    option = next((item for item in _field_options(field) if item["id"] == option_id), None)
    return option["name"] if option else option_id


def _flatten_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        flattened = [_flatten_value(item) for item in value]
        return [item for item in flattened if item not in (None, "", [])]
    if not isinstance(value, dict):
        return str(value)

    if "users" in value:
        return [user.get("name") or user.get("enName") or user.get("userId") for user in value["users"]]
    if "text" in value:
        return value.get("text", "")
    if "name" in value:
        return value.get("name", "")
    if "link" in value:
        return {"text": value.get("text") or value["link"], "url": value["link"]}
    if "url" in value:
        return {"text": value.get("name") or value["url"], "url": value["url"]}
    if "value" in value:
        return _flatten_value(value["value"])
    return json.loads(json.dumps(value, ensure_ascii=False))


def normalize_cell(
    field: dict[str, Any],
    cell: Any,
    record_titles: dict[str, str] | None = None,
) -> Any:
    if cell is None:
        return None
    value = cell.get("value") if isinstance(cell, dict) and "value" in cell else cell
    field_type = field.get("type")

    if field_type == 3:
        return _option_name(field, value)
    if field_type == 4:
        values = value if isinstance(value, list) else [value]
        return [_option_name(field, item) for item in values if item is not None]
    if field_type == 5 and isinstance(value, (int, float)):
        timestamp = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()
    if field_type == 21:
        values = value if isinstance(value, list) else [value]
        titles = record_titles or {}
        normalized = []
        for item in values:
            record_id = item.get("recordId") if isinstance(item, dict) else item
            if record_id:
                normalized.append(titles.get(str(record_id), str(record_id)))
        return normalized

    flattened = _flatten_value(value)
    if field_type == 1 and isinstance(flattened, list):
        return "".join(str(item) for item in flattened)
    return flattened


def _table_snapshot(entry: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, Any], dict[str, Any]]:
    schema = entry["schema"]
    table_data = schema["data"]["table"]
    table_id = table_data["meta"]["id"]
    return table_id, table_data, schema["data"].get("recordMap", {}), schema["data"].get("recordMeta", {})


def _title_field_id(table_data: dict[str, Any]) -> str:
    if table_data.get("primaryKey"):
        return table_data["primaryKey"]
    for view in table_data.get("viewMap", {}).values():
        fields = view.get("property", {}).get("fields", [])
        if fields:
            return fields[0]
    return next(iter(table_data.get("fieldMap", {})), "")


def build_record_titles(entries: list[dict[str, Any]]) -> dict[str, str]:
    titles: dict[str, str] = {}
    for entry in entries:
        _, table_data, record_map, _ = _table_snapshot(entry)
        title_field_id = _title_field_id(table_data)
        field = table_data.get("fieldMap", {}).get(title_field_id, {})
        for record_id, record in record_map.items():
            title = normalize_cell(field, record.get(title_field_id))
            if isinstance(title, list):
                title = "、".join(str(item) for item in title)
            titles[record_id] = str(title or "未命名事项")
    return titles


def normalize_table(entry: dict[str, Any], record_titles: dict[str, str]) -> dict[str, Any]:
    table_id, table_data, record_map, record_meta = _table_snapshot(entry)
    if table_id not in TABLE_DEFINITIONS:
        raise ValueError(f"Unsupported Feishu table: {table_id}")
    key, name, sort_order = TABLE_DEFINITIONS[table_id]
    field_map = table_data.get("fieldMap", {})
    fields = []
    for field_id, field in field_map.items():
        fields.append(
            {
                "id": field_id,
                "name": field.get("name", ""),
                "type": field.get("type"),
                "ui_type": field.get("fieldUIType", "Text"),
                "is_primary": field_id == _title_field_id(table_data),
                "multiple": bool(field.get("property", {}).get("multiple")),
                "options": _field_options(field),
                "readonly": field.get("type") == 20,
            }
        )

    views = []
    for view_id in table_data.get("views", list(table_data.get("viewMap", {}))):
        view = table_data.get("viewMap", {}).get(view_id)
        if not view:
            continue
        prop = view.get("property", {})
        views.append(
            {
                "id": view_id,
                "name": view.get("name") or "表格",
                "type": view.get("type", 1),
                "fields": prop.get("fields", []),
                "source_record_ids": prop.get("records", []),
                "col_infos": prop.get("colInfos", {}),
                "frozen_col_count": prop.get("frozenColCount", 1),
                "filter": prop.get("filterInfo"),
                "group": prop.get("group", []),
                "sort": prop.get("sortInfo", []),
                "gantt": prop.get("ganttConfig"),
            }
        )

    records = []
    title_field_id = _title_field_id(table_data)
    for index, (record_id, record) in enumerate(record_map.items()):
        values = {
            field_id: normalize_cell(field_map[field_id], record.get(field_id), record_titles)
            for field_id in field_map
        }
        title = values.get(title_field_id)
        if isinstance(title, list):
            title = "、".join(str(item) for item in title)
        records.append(
            {
                "id": record_id,
                "title": str(title or record_titles.get(record_id) or "未命名事项"),
                "values": values,
                "source_values": record,
                "source_meta": record_meta.get(record_id, {}),
                "sort_order": index * 1000,
            }
        )

    return {
        "key": key,
        "name": name,
        "sort_order": sort_order,
        "source_table_id": table_id,
        "primary_field_id": title_field_id,
        "fields": fields,
        "views": views,
        "source_schema": {
            "meta": table_data.get("meta", {}),
            "field_map": field_map,
            "view_map": table_data.get("viewMap", {}),
        },
        "records": records,
    }


def normalize_feishu_base(file_path: str) -> list[dict[str, Any]]:
    entries = parse_feishu_base(file_path)
    record_titles = build_record_titles(entries)
    tables = [normalize_table(entry, record_titles) for entry in entries]
    return sorted(tables, key=lambda table: table["sort_order"])
