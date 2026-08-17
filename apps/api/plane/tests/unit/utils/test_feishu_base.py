# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import gzip
import json

import pytest

from plane.utils.feishu_base import normalize_feishu_base


def _write_base_file(tmp_path):
    title_field = {"name": "目标", "type": 1, "fieldUIType": "Text", "property": {}}
    status_field = {
        "name": "状态",
        "type": 3,
        "fieldUIType": "SingleSelect",
        "property": {"options": [{"id": "opt-done", "name": "已完成", "color": 1}]},
    }
    date_field = {"name": "截止日期", "type": 5, "fieldUIType": "DateTime", "property": {}}
    entry = {
        "schema": {
            "data": {
                "table": {
                    "meta": {"id": "tblgFq370WhVVnXc"},
                    "primaryKey": "fld-title",
                    "fieldMap": {
                        "fld-title": title_field,
                        "fld-status": status_field,
                        "fld-date": date_field,
                    },
                    "views": ["viw-all"],
                    "viewMap": {
                        "viw-all": {
                            "name": "全部目标",
                            "type": 1,
                            "property": {
                                "fields": ["fld-title", "fld-status", "fld-date"],
                                "records": ["rec-1"],
                                "colInfos": {"fld-title": {"width": 260}},
                            },
                        }
                    },
                },
                "recordMap": {
                    "rec-1": {
                        "fld-title": {"value": "提升需求质量"},
                        "fld-status": {"value": "opt-done"},
                        "fld-date": {"value": 1_735_689_600_000},
                    }
                },
                "recordMeta": {"rec-1": {"createdTime": 1_700_000_000_000}},
            }
        }
    }
    snapshot = base64.b64encode(gzip.compress(json.dumps([entry]).encode())).decode()
    file_path = tmp_path / "workbench.base"
    file_path.write_text(json.dumps({"gzipSnapshot": snapshot}), encoding="utf-8")
    return file_path


@pytest.mark.unit
def test_normalize_feishu_base_preserves_source_and_resolves_values(tmp_path):
    table = normalize_feishu_base(str(_write_base_file(tmp_path)))[0]
    record = table["records"][0]

    assert table["key"] == "product-goals"
    assert table["name"] == "产品目标"
    assert table["views"][0]["name"] == "全部目标"
    assert record["title"] == "提升需求质量"
    assert record["values"] == {
        "fld-title": "提升需求质量",
        "fld-status": "已完成",
        "fld-date": "2025-01-01",
    }
    assert record["source_values"]["fld-status"] == {"value": "opt-done"}
    assert record["source_meta"] == {"createdTime": 1_700_000_000_000}
