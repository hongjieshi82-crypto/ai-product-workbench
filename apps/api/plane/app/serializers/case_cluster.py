# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import CaseCluster, CaseClusterAnalysis, CaseClusterItem

from .base import BaseSerializer


class CaseClusterItemSerializer(BaseSerializer):
    issue_id = serializers.UUIDField(read_only=True)
    cluster_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = CaseClusterItem
        fields = [
            "id",
            "issue_id",
            "cluster_id",
            "source_snapshot",
            "sort_order",
            "created_at",
            "updated_at",
        ]


class CaseClusterSerializer(BaseSerializer):
    analysis_id = serializers.UUIDField(read_only=True)
    merged_into_id = serializers.UUIDField(read_only=True, allow_null=True)
    items = CaseClusterItemSerializer(many=True, read_only=True)

    class Meta:
        model = CaseCluster
        fields = [
            "id",
            "analysis_id",
            "category",
            "name",
            "summary",
            "typical_feedback",
            "product_opportunity",
            "sort_order",
            "merged_into_id",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["analysis_id", "sort_order", "merged_into_id", "items", "created_at", "updated_at"]


class CaseClusterAnalysisSerializer(BaseSerializer):
    clusters = CaseClusterSerializer(many=True, read_only=True)

    class Meta:
        model = CaseClusterAnalysis
        fields = [
            "id",
            "name",
            "status",
            "model_name",
            "source_count",
            "error",
            "clusters",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
