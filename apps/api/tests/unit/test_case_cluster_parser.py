import json

import pytest

from plane.utils.case_cluster import CaseClusterResponseError, parse_case_cluster_response


def test_parse_case_cluster_response_assigns_each_issue_once():
    response = json.dumps(
        {
            "clusters": [
                {
                    "category": "scene",
                    "name": "搜索商品",
                    "summary": "用户在搜索阶段遇到问题",
                    "issue_ids": ["issue-1", "issue-2"],
                    "typical_feedback": "搜不到想要的商品",
                    "product_opportunity": "改进召回与结果解释",
                },
                {
                    "category": "opportunity",
                    "name": "搜索引导",
                    "summary": "通过引导降低搜索成本",
                    "issue_ids": ["issue-2", "issue-3", "unknown"],
                    "typical_feedback": "不知道怎么搜索",
                    "product_opportunity": "提供可操作的搜索建议",
                },
            ]
        }
    )

    clusters = parse_case_cluster_response(response, ["issue-1", "issue-2", "issue-3"])

    assert clusters[0]["issue_ids"] == ["issue-1", "issue-2"]
    assert clusters[1]["issue_ids"] == ["issue-3"]
    assert [issue_id for cluster in clusters for issue_id in cluster["issue_ids"]] == [
        "issue-1",
        "issue-2",
        "issue-3",
    ]


def test_parse_case_cluster_response_keeps_unassigned_issues_for_manual_review():
    response = """```json
    {"clusters":[{"category":"badcase","name":"响应错误","summary":"","issue_ids":["issue-1"],
    "typical_feedback":"","product_opportunity":""}]}
    ```"""

    clusters = parse_case_cluster_response(response, ["issue-1", "issue-2"])

    assert clusters[-1]["name"] == "待人工归类"
    assert clusters[-1]["issue_ids"] == ["issue-2"]


def test_parse_case_cluster_response_rejects_unusable_payload():
    with pytest.raises(CaseClusterResponseError):
        parse_case_cluster_response('{"clusters": []}', ["issue-1"])
