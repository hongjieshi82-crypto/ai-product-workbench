# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.db.models import Q

from .project import ProjectBaseModel


class CaseClusterAnalysisStatus(models.TextChoices):
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class CaseClusterCategory(models.TextChoices):
    SCENE = "scene", "Scene"
    REQUIREMENT = "requirement", "Requirement"
    BADCASE = "badcase", "Badcase"
    OPPORTUNITY = "opportunity", "Opportunity"


class CaseClusterAnalysis(ProjectBaseModel):
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=CaseClusterAnalysisStatus.choices,
        default=CaseClusterAnalysisStatus.PROCESSING,
    )
    model_name = models.CharField(max_length=255, blank=True)
    source_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict)

    class Meta:
        db_table = "case_cluster_analyses"
        ordering = ("-created_at",)


class CaseCluster(ProjectBaseModel):
    analysis = models.ForeignKey(
        "db.CaseClusterAnalysis",
        on_delete=models.CASCADE,
        related_name="clusters",
    )
    category = models.CharField(max_length=20, choices=CaseClusterCategory.choices)
    name = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    typical_feedback = models.TextField(blank=True)
    product_opportunity = models.TextField(blank=True)
    sort_order = models.FloatField(default=65535)
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="merged_clusters",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "case_clusters"
        ordering = ("sort_order", "created_at")


class CaseClusterItem(ProjectBaseModel):
    analysis = models.ForeignKey(
        "db.CaseClusterAnalysis",
        on_delete=models.CASCADE,
        related_name="items",
    )
    cluster = models.ForeignKey(
        "db.CaseCluster",
        on_delete=models.CASCADE,
        related_name="items",
    )
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.PROTECT,
        related_name="case_cluster_items",
    )
    source_snapshot = models.JSONField(default=dict)
    sort_order = models.FloatField(default=65535)

    class Meta:
        db_table = "case_cluster_items"
        ordering = ("sort_order", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["analysis", "issue"],
                condition=Q(deleted_at__isnull=True),
                name="case_cluster_item_unique_analysis_issue",
            )
        ]
