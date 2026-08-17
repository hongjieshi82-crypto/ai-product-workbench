# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from typing import Any


CASE_CLUSTER_CATEGORIES = {"scene", "requirement", "badcase", "opportunity"}


class CaseClusterResponseError(ValueError):
    pass


def parse_case_cluster_response(response: str, selected_issue_ids: list[str]) -> list[dict[str, Any]]:
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise CaseClusterResponseError("AI response does not contain a JSON object")

    try:
        payload = json.loads(text[start : end + 1])
    except json.JSONDecodeError as error:
        raise CaseClusterResponseError("AI response is not valid JSON") from error

    raw_clusters = payload.get("clusters")
    if not isinstance(raw_clusters, list) or not raw_clusters:
        raise CaseClusterResponseError("AI response must contain at least one cluster")

    selected = set(selected_issue_ids)
    assigned: set[str] = set()
    clusters: list[dict[str, Any]] = []

    for raw_cluster in raw_clusters:
        if not isinstance(raw_cluster, dict):
            continue
        category = raw_cluster.get("category")
        name = raw_cluster.get("name")
        if category not in CASE_CLUSTER_CATEGORIES or not isinstance(name, str) or not name.strip():
            continue

        raw_issue_ids = raw_cluster.get("issue_ids", [])
        issue_ids = []
        if isinstance(raw_issue_ids, list):
            for issue_id in raw_issue_ids:
                normalized_id = str(issue_id)
                if normalized_id in selected and normalized_id not in assigned:
                    issue_ids.append(normalized_id)
                    assigned.add(normalized_id)

        if not issue_ids:
            continue

        clusters.append(
            {
                "category": category,
                "name": name.strip()[:255],
                "summary": str(raw_cluster.get("summary") or "").strip(),
                "typical_feedback": str(raw_cluster.get("typical_feedback") or "").strip(),
                "product_opportunity": str(raw_cluster.get("product_opportunity") or "").strip(),
                "issue_ids": issue_ids,
            }
        )

    if not clusters:
        raise CaseClusterResponseError("AI response contains no usable clusters")

    unassigned = [issue_id for issue_id in selected_issue_ids if issue_id not in assigned]
    if unassigned:
        clusters.append(
            {
                "category": "scene",
                "name": "待人工归类",
                "summary": "AI 未能稳定归入现有聚类的事项。",
                "typical_feedback": "",
                "product_opportunity": "需要人工复核后再归类。",
                "issue_ids": unassigned,
            }
        )

    return clusters
