# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

from copy import deepcopy


DEFAULT_OPTIONS = {
    "优先级": ["P0", "P1", "P2", "P3"],
    "优先级 (1)": ["P0", "P1", "P2", "P3"],
    "状态": ["未开始", "进行中", "已完成"],
    "进度": ["未开始", "进行中", "已完成"],
    "进度状态": ["未开始", "进行中", "已完成", "已取消"],
    "阶段": ["第一阶段", "第二阶段", "持续进行"],
    "评分（0-5）": ["0", "1", "2", "3", "4", "5"],
    "数据评分": ["1", "2", "3", "4", "5"],
    "价值评分": ["1", "2", "3", "4", "5"],
}


def _field(field_id, name, field_type=1, ui_type="Text", *, primary=False, readonly=False):
    option_names = DEFAULT_OPTIONS.get(name, [])
    return {
        "id": field_id,
        "name": name,
        "type": field_type,
        "options": [
            {"id": f"{field_id}-option-{index}", "name": option_name, "color": index}
            for index, option_name in enumerate(option_names)
        ],
        "ui_type": ui_type,
        "multiple": field_type in {4, 11, 21},
        "readonly": readonly,
        "is_primary": primary,
    }


def _view(view_id, name, fields, view_type=1):
    return {
        "id": view_id,
        "name": name,
        "sort": [],
        "type": view_type,
        "gantt": None,
        "group": [],
        "fields": fields,
        "filter": None,
        "col_infos": {},
        "frozen_col_count": 1,
        "source_record_ids": [],
    }


def _table(key, name, sort_order, fields, view_names):
    primary_field = next(field for field in fields if field[4])
    normalized_fields = [
        _field(field_id, field_name, field_type, ui_type, primary=primary, readonly=readonly)
        for field_id, field_name, field_type, ui_type, primary, readonly in fields
    ]
    field_ids = [field["id"] for field in normalized_fields]
    return {
        "key": key,
        "name": name,
        "sort_order": sort_order,
        "source_table_id": f"workbench-{key}",
        "primary_field_id": primary_field[0],
        "fields": normalized_fields,
        "views": [
            _view(
                f"{key}-view-{index}",
                view_name,
                field_ids,
                8 if "时间轴" in view_name else 7 if "日历" in view_name else 1,
            )
            for index, view_name in enumerate(view_names)
        ],
        "source_schema": {},
    }


def FIELD(field_id, name, field_type=1, ui_type="Text", primary=False, readonly=False):
    return field_id, name, field_type, ui_type, primary, readonly


PERSONAL_WORKBENCH_TEMPLATE = [
    _table(
        "product-goals",
        "产品目标",
        0,
        [
            FIELD("goal-title", "子目标", primary=True),
            FIELD("goal-parent", "总目标", 3, "SingleSelect"),
            FIELD("goal-owner", "负责人", 11, "User"),
            FIELD("goal-metric", "指标"),
            FIELD("goal-priority", "优先级", 3, "SingleSelect"),
            FIELD("goal-stage", "阶段", 3, "SingleSelect"),
            FIELD("goal-status", "状态", 3, "SingleSelect"),
            FIELD("goal-start", "开始时间", 5, "DateTime"),
            FIELD("goal-end", "结束时间", 5, "DateTime"),
            FIELD("goal-description", "描述"),
            FIELD("goal-tasks", "相关任务", 21, "DuplexLink"),
        ],
        ["产品目标", "甘特图视角"],
    ),
    _table(
        "personal-tasks",
        "个人任务",
        1,
        [
            FIELD("task-title", "任务名称", primary=True),
            FIELD("task-description", "任务详细描述"),
            FIELD("task-created", "创建日期", 5, "DateTime"),
            FIELD("task-due", "截止日期", 5, "DateTime"),
            FIELD("task-complete", "是否完成", 7, "Checkbox"),
            FIELD("task-priority", "优先级", 3, "SingleSelect"),
            FIELD("task-status", "进度状态", 3, "SingleSelect"),
            FIELD("task-owner", "任务执行人", 11, "User"),
            FIELD("task-attachment", "关联附件", 15, "Url"),
        ],
        ["全部任务", "待办任务", "任务截止日历"],
    ),
    _table(
        "scenarios",
        "场景挖掘",
        2,
        [
            FIELD("scenario-title", "需求名称", primary=True),
            FIELD("scenario-pain", "场景描述+痛点"),
            FIELD("scenario-frequency", "人数*频次*时间"),
            FIELD("scenario-stage", "所处环节", 4, "MultiSelect"),
            FIELD("scenario-source", "需求方", 4, "MultiSelect"),
            FIELD("scenario-value", "核心价值"),
            FIELD("scenario-value-score", "价值评分", 3, "SingleSelect"),
            FIELD("scenario-data-score", "数据评分", 3, "SingleSelect"),
            FIELD("scenario-summary", "分析总结/备注"),
            FIELD("scenario-priority", "优先级", 3, "SingleSelect"),
        ],
        ["客户侧", "产品侧", "公司侧", "全部场景"],
    ),
    _table(
        "requirements",
        "需求池",
        3,
        [
            FIELD("requirement-title", "需求名称", primary=True),
            FIELD("requirement-goal", "需求目标", 3, "SingleSelect"),
            FIELD("requirement-scenario", "关联场景", 21, "DuplexLink"),
            FIELD("requirement-owner", "开发/算法负责人", 11, "User"),
            FIELD("requirement-designer", "设计负责人", 11, "User"),
            FIELD("requirement-priority", "优先级", 3, "SingleSelect"),
            FIELD("requirement-status", "状态", 3, "SingleSelect"),
            FIELD("requirement-version", "迭代版本", 3, "SingleSelect"),
            FIELD("requirement-start", "开始时间", 5, "DateTime"),
            FIELD("requirement-end", "结束时间", 5, "DateTime"),
            FIELD("requirement-document", "文档链接", 15, "Url"),
        ],
        ["所有需求", "未完成需求", "待排期需求", "甘特视角"],
    ),
    _table(
        "functions",
        "功能清单",
        4,
        [
            FIELD("function-module", "模块", primary=True),
            FIELD("function-level-one", "一级功能", 3, "SingleSelect"),
            FIELD("function-level-two", "二级功能"),
            FIELD("function-level-three", "三级功能"),
            FIELD("function-roles", "使用角色", 4, "MultiSelect"),
            FIELD("function-description", "描述"),
            FIELD("function-priority", "优先级", 3, "SingleSelect"),
            FIELD("function-progress", "进度", 3, "SingleSelect"),
        ],
        ["总功能", "Web 端"],
    ),
    _table(
        "iterations",
        "迭代任务",
        5,
        [
            FIELD("iteration-title", "子任务", primary=True),
            FIELD("iteration-parent", "任务"),
            FIELD("iteration-requirement", "关联需求", 21, "DuplexLink"),
            FIELD("iteration-description", "任务详细描述"),
            FIELD("iteration-owner", "任务执行人", 11, "User"),
            FIELD("iteration-priority", "优先级", 3, "SingleSelect"),
            FIELD("iteration-status", "进度状态", 3, "SingleSelect"),
            FIELD("iteration-complete", "是否完成", 7, "Checkbox"),
            FIELD("iteration-version", "迭代版本", 3, "SingleSelect"),
            FIELD("iteration-start", "开始日期", 5, "DateTime"),
            FIELD("iteration-created", "创建日期", 5, "DateTime"),
            FIELD("iteration-due", "截止日期", 5, "DateTime"),
            FIELD("iteration-attachment", "关联附件", 15, "Url"),
        ],
        ["总任务", "待办事项", "任务截止日历", "时间轴"],
    ),
    _table(
        "bugs",
        "Bug 清单",
        6,
        [
            FIELD("bug-title", "Bug 描述", primary=True),
            FIELD("bug-priority", "优先级", 3, "SingleSelect"),
            FIELD("bug-status", "状态", 3, "SingleSelect"),
            FIELD("bug-version", "修复版本", 3, "SingleSelect"),
            FIELD("bug-created", "登记时间", 5, "DateTime"),
            FIELD("bug-reporter", "提交人", 11, "User"),
            FIELD("bug-owner", "指派人", 11, "User"),
            FIELD("bug-screenshot", "截图", 17, "Attachment"),
            FIELD("bug-result", "结果登记", 17, "Attachment"),
            FIELD("bug-note", "备注"),
        ],
        ["表格"],
    ),
    _table(
        "badcases",
        "Badcase",
        7,
        [
            FIELD("badcase-title", "问题", primary=True),
            FIELD("badcase-answer", "回答结果"),
            FIELD("badcase-reason", "备注（为什么回答的不好）"),
            FIELD("badcase-score", "评分（0-5）", 3, "SingleSelect"),
            FIELD("badcase-category", "问题大类", 3, "SingleSelect"),
            FIELD("badcase-subcategory", "子类", 4, "MultiSelect"),
            FIELD("badcase-action", "行动"),
            FIELD("badcase-status", "状态", 3, "SingleSelect"),
            FIELD("badcase-reporter", "提交人", 11, "User"),
            FIELD("badcase-screenshot", "截图", 17, "Attachment"),
        ],
        ["表格"],
    ),
    _table(
        "case-clusters",
        "Case 聚类分析",
        8,
        [
            FIELD("cluster-title", "具体问题", primary=True),
            FIELD("cluster-direct-reason", "直接原因"),
            FIELD("cluster-root-reason", "本质原因"),
            FIELD("cluster-technical-reason", "技术原因"),
            FIELD("cluster-category", "问题分类", 3, "SingleSelect"),
            FIELD("cluster-tags", "标签", 4, "MultiSelect"),
            FIELD("cluster-opportunity", "解决方向"),
            FIELD("cluster-task", "核心任务项"),
            FIELD("cluster-priority", "优先级", 3, "SingleSelect"),
            FIELD("cluster-status", "状态", 3, "SingleSelect"),
            FIELD("cluster-note", "备注"),
        ],
        ["总表", "重点关注", "待解决", "关联目标"],
    ),
]


def get_personal_workbench_template():
    return deepcopy(PERSONAL_WORKBENCH_TEMPLATE)
