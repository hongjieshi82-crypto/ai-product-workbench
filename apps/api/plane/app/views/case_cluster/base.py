# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
from uuid import UUID

from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import CaseClusterAnalysisSerializer, CaseClusterSerializer
from plane.app.views.external.base import get_llm_config, get_llm_response
from plane.db.models import (
    CaseCluster,
    CaseClusterAnalysis,
    CaseClusterAnalysisStatus,
    CaseClusterCategory,
    CaseClusterItem,
    Issue,
    Project,
)
from plane.utils.case_cluster import CaseClusterResponseError, parse_case_cluster_response

from .. import BaseAPIView


MAX_CASE_CLUSTER_ISSUES = 100
CASE_CLUSTER_SOURCE_TYPES = {"scenarios", "requirements", "badcases"}


def _analysis_queryset(slug, project_id):
    return (
        CaseClusterAnalysis.objects.filter(workspace__slug=slug, project_id=project_id)
        .prefetch_related(
            Prefetch(
                "clusters",
                queryset=CaseCluster.objects.prefetch_related("items"),
            )
        )
        .order_by("-created_at")
    )


def _serialize_analysis(slug, project_id, analysis_id):
    analysis = _analysis_queryset(slug, project_id).get(id=analysis_id)
    return CaseClusterAnalysisSerializer(analysis).data


def _issue_snapshot(issue):
    description = issue.description_stripped or ""
    workbench_item = getattr(issue, "personal_workbench_item", None)
    if workbench_item:
        field_names = {field["id"]: field["name"] for field in workbench_item.table.fields}
        details = []
        for field_id, value in workbench_item.values.items():
            if value in (None, "", []):
                continue
            if isinstance(value, list):
                value = "、".join(str(item) for item in value)
            elif isinstance(value, dict):
                value = value.get("text") or value.get("url") or json.dumps(value, ensure_ascii=False)
            details.append(f"{field_names.get(field_id, field_id)}：{value}")
        description = "\n".join(details)[:6000] or description
    return {
        "id": str(issue.id),
        "identifier": f"{issue.project.identifier}-{issue.sequence_id}",
        "name": issue.name,
        "description": description,
        "priority": issue.priority,
        "state": issue.state.name if issue.state else "",
        "type": issue.type.name if issue.type else "",
        "labels": [label.name for label in issue.labels.all()],
    }


def _validated_issue_ids(raw_issue_ids):
    if not isinstance(raw_issue_ids, list):
        return None
    issue_ids = []
    seen = set()
    try:
        for raw_issue_id in raw_issue_ids:
            issue_id = str(UUID(str(raw_issue_id)))
            if issue_id not in seen:
                issue_ids.append(issue_id)
                seen.add(issue_id)
    except (TypeError, ValueError, AttributeError):
        return None
    return issue_ids


class CaseClusterCandidateEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        search = request.GET.get("search", "").strip()
        queryset = (
            Issue.objects.filter(
                project_id=project_id,
                workspace__slug=slug,
                type__external_source="personal_workbench",
                type__external_id__in=CASE_CLUSTER_SOURCE_TYPES,
            )
            .select_related("project", "state", "type", "personal_workbench_item__table")
            .prefetch_related("labels")
            .order_by("-updated_at")
        )
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description_stripped__icontains=search))

        return Response([_issue_snapshot(issue) for issue in queryset[:200]], status=status.HTTP_200_OK)


class CaseClusterAnalysisEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        return Response(
            CaseClusterAnalysisSerializer(_analysis_queryset(slug, project_id), many=True).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        issue_ids = _validated_issue_ids(request.data.get("issue_ids"))
        if issue_ids is None or len(issue_ids) < 2:
            return Response({"error": "请至少选择两个有效事项"}, status=status.HTTP_400_BAD_REQUEST)
        if len(issue_ids) > MAX_CASE_CLUSTER_ISSUES:
            return Response(
                {"error": f"单次分析最多支持 {MAX_CASE_CLUSTER_ISSUES} 个事项"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = Project.objects.filter(id=project_id, workspace__slug=slug).first()
        if not project:
            return Response({"error": "个人产品不存在"}, status=status.HTTP_404_NOT_FOUND)

        issues = list(
            Issue.objects.filter(
                id__in=issue_ids,
                project=project,
                type__external_source="personal_workbench",
                type__external_id__in=CASE_CLUSTER_SOURCE_TYPES,
            )
            .select_related("project", "state", "type", "personal_workbench_item__table")
            .prefetch_related("labels")
        )
        issue_map = {str(issue.id): issue for issue in issues}
        if len(issue_map) != len(issue_ids):
            return Response(
                {"error": "选择内容中包含不能用于聚类的事项"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis_name = str(request.data.get("name") or "").strip()[:255]
        if not analysis_name:
            analysis_name = f"Case 聚类分析 {timezone.localtime().strftime('%Y-%m-%d %H:%M')}"

        analysis = CaseClusterAnalysis.objects.create(
            name=analysis_name,
            project=project,
            source_count=len(issue_ids),
        )
        api_key, model, provider = get_llm_config()
        if not api_key or not model or not provider:
            analysis.status = CaseClusterAnalysisStatus.FAILED
            analysis.error = "尚未配置 AI 模型，请先填写模型地址、密钥和模型名称"
            analysis.save()
            return Response(
                {"error": analysis.error, "analysis_id": analysis.id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        snapshots = [_issue_snapshot(issue_map[issue_id]) for issue_id in issue_ids]
        task = (
            "你是一名产品经理。请按照共同的用户场景和问题，将提供的反馈、需求和 Badcase 聚类。"
            "所有名称、摘要、典型反馈和产品机会必须使用中文。仅返回 JSON，顶层字段为 clusters。"
            "每个聚类必须包含 category（scene、requirement、badcase 或 opportunity）、name、summary、"
            "issue_ids、typical_feedback 和 product_opportunity。每个事项 ID 必须且只能使用一次，不得编造 ID。"
        )
        prompt = json.dumps({"work_items": snapshots}, ensure_ascii=False)
        text, error = get_llm_response(task, prompt, api_key, model, provider)
        if not text:
            analysis.status = CaseClusterAnalysisStatus.FAILED
            analysis.model_name = model
            analysis.error = error or "AI 没有返回内容"
            analysis.save()
            return Response(
                {"error": analysis.error, "analysis_id": analysis.id},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            cluster_payloads = parse_case_cluster_response(text, issue_ids)
        except CaseClusterResponseError as parse_error:
            analysis.status = CaseClusterAnalysisStatus.FAILED
            analysis.model_name = model
            analysis.error = str(parse_error)
            analysis.raw_response = {"text": text}
            analysis.save()
            return Response(
                {"error": analysis.error, "analysis_id": analysis.id},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            for cluster_index, cluster_payload in enumerate(cluster_payloads):
                cluster = CaseCluster.objects.create(
                    analysis=analysis,
                    project=project,
                    category=cluster_payload["category"],
                    name=cluster_payload["name"],
                    summary=cluster_payload["summary"],
                    typical_feedback=cluster_payload["typical_feedback"],
                    product_opportunity=cluster_payload["product_opportunity"],
                    sort_order=cluster_index * 1000,
                )
                CaseClusterItem.objects.bulk_create(
                    [
                        CaseClusterItem(
                            analysis=analysis,
                            cluster=cluster,
                            issue=issue_map[issue_id],
                            source_snapshot=next(snapshot for snapshot in snapshots if snapshot["id"] == issue_id),
                            sort_order=item_index * 1000,
                            project=project,
                            workspace=project.workspace,
                            created_by=request.user,
                        )
                        for item_index, issue_id in enumerate(cluster_payload["issue_ids"])
                    ]
                )

            analysis.status = CaseClusterAnalysisStatus.READY
            analysis.model_name = model
            analysis.raw_response = {"text": text}
            analysis.error = ""
            analysis.save()

        return Response(
            _serialize_analysis(slug, project_id, analysis.id),
            status=status.HTTP_201_CREATED,
        )


class CaseClusterAnalysisDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, analysis_id):
        return Response(
            _serialize_analysis(slug, project_id, analysis_id),
            status=status.HTTP_200_OK,
        )


class CaseClusterDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, analysis_id, cluster_id):
        cluster = CaseCluster.objects.filter(
            id=cluster_id,
            analysis_id=analysis_id,
            project_id=project_id,
            workspace__slug=slug,
            merged_into__isnull=True,
        ).first()
        if not cluster:
            return Response({"error": "Active cluster not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CaseClusterSerializer(cluster, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            _serialize_analysis(slug, project_id, analysis_id),
            status=status.HTTP_200_OK,
        )


class CaseClusterMergeEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, analysis_id):
        source_ids = _validated_issue_ids(request.data.get("source_cluster_ids"))
        try:
            target_id = str(UUID(str(request.data.get("target_cluster_id"))))
        except (TypeError, ValueError, AttributeError):
            target_id = None
        if not source_ids or not target_id or target_id in source_ids:
            return Response(
                {"error": "Choose a target and at least one source cluster"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            clusters = list(
                CaseCluster.objects.select_for_update().filter(
                    id__in=[target_id, *source_ids],
                    analysis_id=analysis_id,
                    project_id=project_id,
                    workspace__slug=slug,
                    merged_into__isnull=True,
                )
            )
            cluster_map = {str(cluster.id): cluster for cluster in clusters}
            if len(cluster_map) != len(set([target_id, *source_ids])):
                return Response(
                    {"error": "All clusters must be active and belong to the same analysis"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            target = cluster_map[target_id]
            sources = [cluster_map[source_id] for source_id in source_ids]
            CaseClusterItem.objects.filter(cluster__in=sources).update(cluster=target, updated_by=request.user)
            CaseCluster.objects.filter(id__in=source_ids).update(merged_into=target, updated_by=request.user)

        return Response(_serialize_analysis(slug, project_id, analysis_id), status=status.HTTP_200_OK)


class CaseClusterSplitEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, analysis_id, cluster_id):
        issue_ids = _validated_issue_ids(request.data.get("issue_ids"))
        category = request.data.get("category")
        name = str(request.data.get("name") or "").strip()[:255]
        if not issue_ids or category not in CaseClusterCategory.values or not name:
            return Response(
                {"error": "Name, category and at least one work item are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            source = CaseCluster.objects.select_for_update().filter(
                id=cluster_id,
                analysis_id=analysis_id,
                project_id=project_id,
                workspace__slug=slug,
                merged_into__isnull=True,
            ).first()
            if not source:
                return Response({"error": "Active cluster not found"}, status=status.HTTP_404_NOT_FOUND)

            source_items = CaseClusterItem.objects.select_for_update().filter(cluster=source)
            selected_items = source_items.filter(issue_id__in=issue_ids)
            if selected_items.count() != len(issue_ids) or source_items.count() == len(issue_ids):
                return Response(
                    {"error": "Split items must be a proper subset of the source cluster"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            new_cluster = CaseCluster.objects.create(
                analysis=source.analysis,
                project=source.project,
                category=category,
                name=name,
                summary=str(request.data.get("summary") or "").strip(),
                typical_feedback=str(request.data.get("typical_feedback") or "").strip(),
                product_opportunity=str(request.data.get("product_opportunity") or "").strip(),
                sort_order=source.sort_order + 1,
            )
            selected_items.update(cluster=new_cluster, updated_by=request.user)

        return Response(_serialize_analysis(slug, project_id, analysis_id), status=status.HTTP_201_CREATED)


class CaseClusterItemEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, analysis_id, item_id):
        try:
            target_cluster_id = UUID(str(request.data.get("cluster_id")))
        except (TypeError, ValueError, AttributeError):
            return Response({"error": "A valid target cluster is required"}, status=status.HTTP_400_BAD_REQUEST)

        item = CaseClusterItem.objects.filter(
            id=item_id,
            analysis_id=analysis_id,
            project_id=project_id,
            workspace__slug=slug,
        ).first()
        target = CaseCluster.objects.filter(
            id=target_cluster_id,
            analysis_id=analysis_id,
            project_id=project_id,
            workspace__slug=slug,
            merged_into__isnull=True,
        ).first()
        if not item or not target:
            return Response({"error": "Item or target cluster not found"}, status=status.HTTP_404_NOT_FOUND)

        item.cluster = target
        item.save()
        return Response(_serialize_analysis(slug, project_id, analysis_id), status=status.HTTP_200_OK)
