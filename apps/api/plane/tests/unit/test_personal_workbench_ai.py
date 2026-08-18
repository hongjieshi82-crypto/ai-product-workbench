# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import json

import pytest

from plane.utils.personal_workbench_ai import (
    WorkbenchAISuggestionError,
    local_workbench_suggestion,
    parse_workbench_ai_suggestion,
)


TABLES = [
    {
        "key": "requirements",
        "name": "需求池",
        "primary_field_id": "title",
        "fields": [
            {"id": "title", "name": "需求名称", "type": 1, "options": [], "multiple": False},
            {
                "id": "priority",
                "name": "优先级",
                "type": 3,
                "options": [{"name": "P0"}, {"name": "P1"}],
                "multiple": False,
            },
            {"id": "start", "name": "开始时间", "type": 5, "options": [], "multiple": False},
        ],
    },
    {
        "key": "bugs",
        "name": "Bug 清单",
        "primary_field_id": "bug-title",
        "fields": [{"id": "bug-title", "name": "Bug 描述", "type": 1, "options": [], "multiple": False}],
    },
]


@pytest.mark.unit
def test_parse_ai_suggestion_keeps_only_existing_valid_fields():
    response = json.dumps(
        {
            "table_key": "requirements",
            "title": "增加日期筛选",
            "confidence": 2,
            "reason": "这是一个尚未实现的产品能力",
            "values": {
                "priority": "不存在的级别",
                "start": "不是日期",
                "invented": "不能保存",
            },
        },
        ensure_ascii=False,
    )

    suggestion = parse_workbench_ai_suggestion(response, TABLES)

    assert suggestion == {
        "table_key": "requirements",
        "reason": "这是一个尚未实现的产品能力",
        "confidence": 1,
        "values": {"title": "增加日期筛选", "priority": "", "start": ""},
    }


@pytest.mark.unit
def test_local_suggestion_routes_an_error_to_bug_list():
    suggestion = local_workbench_suggestion("搜索页面打开时报错，无法继续操作", TABLES)

    assert suggestion["table_key"] == "bugs"
    assert suggestion["values"]["bug-title"] == "搜索页面打开时报错，无法继续操作"


@pytest.mark.unit
def test_parse_ai_suggestion_rejects_an_unknown_table():
    with pytest.raises(WorkbenchAISuggestionError):
        parse_workbench_ai_suggestion('{"table_key":"finance","values":{}}', TABLES)
