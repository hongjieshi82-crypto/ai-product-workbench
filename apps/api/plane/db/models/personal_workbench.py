# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class PersonalWorkbenchTable(ProjectBaseModel):
    key = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    source_table_id = models.CharField(max_length=50)
    sort_order = models.PositiveIntegerField(default=0)
    primary_field_id = models.CharField(max_length=50, blank=True)
    fields = models.JSONField(default=list)
    views = models.JSONField(default=list)
    source_schema = models.JSONField(default=dict)

    class Meta:
        db_table = "personal_workbench_tables"
        ordering = ("sort_order", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["project", "key"],
                condition=Q(deleted_at__isnull=True),
                name="personal_workbench_table_unique_project_key",
            ),
            models.UniqueConstraint(
                fields=["project", "source_table_id"],
                condition=Q(deleted_at__isnull=True),
                name="personal_workbench_table_unique_project_source",
            ),
        ]


class PersonalWorkbenchItem(ProjectBaseModel):
    table = models.ForeignKey(
        PersonalWorkbenchTable,
        on_delete=models.PROTECT,
        related_name="items",
    )
    issue = models.OneToOneField(
        "db.Issue",
        on_delete=models.PROTECT,
        related_name="personal_workbench_item",
    )
    values = models.JSONField(default=dict)
    source_values = models.JSONField(default=dict)
    source_record_id = models.CharField(max_length=50, blank=True, null=True)
    sort_order = models.FloatField(default=65535)

    class Meta:
        db_table = "personal_workbench_items"
        ordering = ("sort_order", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["table", "source_record_id"],
                condition=Q(deleted_at__isnull=True, source_record_id__isnull=False),
                name="personal_workbench_item_unique_source_record",
            )
        ]
