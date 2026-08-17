# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from uuid import uuid4

import pytest

from plane.app.views.case_cluster.base import _issue_snapshot


@pytest.mark.unit
def test_issue_snapshot_uses_full_personal_workbench_content():
    issue = SimpleNamespace(
        id=uuid4(),
        project=SimpleNamespace(identifier="PM"),
        sequence_id=12,
        name="搜索结果不准确",
        description_stripped="",
        priority="high",
        state=SimpleNamespace(name="待评估"),
        type=SimpleNamespace(name="Badcase"),
        labels=SimpleNamespace(all=lambda: []),
        personal_workbench_item=SimpleNamespace(
            table=SimpleNamespace(
                fields=[
                    {"id": "title", "name": "问题"},
                    {"id": "feedback", "name": "典型反馈"},
                    {"id": "tags", "name": "标签"},
                ]
            ),
            values={
                "title": "搜索结果不准确",
                "feedback": "用户搜不到已经存在的内容",
                "tags": ["搜索", "召回"],
            },
        ),
    )

    snapshot = _issue_snapshot(issue)

    assert snapshot["type"] == "Badcase"
    assert "问题：搜索结果不准确" in snapshot["description"]
    assert "典型反馈：用户搜不到已经存在的内容" in snapshot["description"]
    assert "标签：搜索、召回" in snapshot["description"]
