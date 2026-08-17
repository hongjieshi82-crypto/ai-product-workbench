# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.test import override_settings

from plane.app.views.case_cluster.base import _can_access_personal_project, _issue_snapshot
from plane.db.models import ProjectMember, User
from plane.utils.personal_workspace import setup_user_personal_workspace


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


@pytest.mark.unit
@pytest.mark.django_db
@override_settings(PRODUCT_WORKBENCH_MODE=True)
def test_case_cluster_rejects_a_different_account_even_if_it_has_project_membership():
    owner = User.objects.create(email="owner@example.com", username="owner")
    other = User.objects.create(email="other@example.com", username="other")
    owner_workbench = setup_user_personal_workspace(owner)
    ProjectMember.objects.create(
        project=owner_workbench.project,
        member=other,
        role=15,
    )

    assert _can_access_personal_project(
        SimpleNamespace(user=owner),
        owner_workbench.workspace.slug,
        owner_workbench.project.id,
    )
    assert not _can_access_personal_project(
        SimpleNamespace(user=other),
        owner_workbench.workspace.slug,
        owner_workbench.project.id,
    )
