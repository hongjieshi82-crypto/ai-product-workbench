# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    CaseClusterAnalysisDetailEndpoint,
    CaseClusterAnalysisEndpoint,
    CaseClusterCandidateEndpoint,
    CaseClusterDetailEndpoint,
    CaseClusterItemEndpoint,
    CaseClusterMergeEndpoint,
    CaseClusterSplitEndpoint,
)


urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-candidates/",
        CaseClusterCandidateEndpoint.as_view(),
        name="case-cluster-candidates",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/",
        CaseClusterAnalysisEndpoint.as_view(),
        name="case-cluster-analyses",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/<uuid:analysis_id>/",
        CaseClusterAnalysisDetailEndpoint.as_view(),
        name="case-cluster-analysis-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/<uuid:analysis_id>/clusters/<uuid:cluster_id>/",
        CaseClusterDetailEndpoint.as_view(),
        name="case-cluster-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/<uuid:analysis_id>/merge/",
        CaseClusterMergeEndpoint.as_view(),
        name="case-cluster-merge",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/<uuid:analysis_id>/clusters/<uuid:cluster_id>/split/",
        CaseClusterSplitEndpoint.as_view(),
        name="case-cluster-split",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/case-cluster-analyses/<uuid:analysis_id>/items/<uuid:item_id>/",
        CaseClusterItemEndpoint.as_view(),
        name="case-cluster-item",
    ),
]
