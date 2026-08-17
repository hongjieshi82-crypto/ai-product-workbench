/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TCaseClusterAnalysis,
  TCaseClusterCandidate,
  TCaseClusterCategory,
  TCaseClusterUpdate,
} from "@plane/types";
import { APIService } from "@/services/api.service";

export class CaseClusterService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private basePath(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}`;
  }

  async getCandidates(workspaceSlug: string, projectId: string, search = ""): Promise<TCaseClusterCandidate[]> {
    return this.get(`${this.basePath(workspaceSlug, projectId)}/case-cluster-candidates/`, {
      params: search ? { search } : undefined,
    })
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getAnalyses(workspaceSlug: string, projectId: string): Promise<TCaseClusterAnalysis[]> {
    return this.get(`${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/`)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createAnalysis(
    workspaceSlug: string,
    projectId: string,
    data: { name?: string; issue_ids: string[] }
  ): Promise<TCaseClusterAnalysis> {
    return this.post(`${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/`, data)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateCluster(
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: Partial<TCaseClusterUpdate>
  ): Promise<TCaseClusterAnalysis> {
    return this.patch(
      `${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/${analysisId}/clusters/${clusterId}/`,
      data
    )
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async mergeClusters(
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    data: { target_cluster_id: string; source_cluster_ids: string[] }
  ): Promise<TCaseClusterAnalysis> {
    return this.post(`${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/${analysisId}/merge/`, data)
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async splitCluster(
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: {
      name: string;
      category: TCaseClusterCategory;
      issue_ids: string[];
      summary?: string;
    }
  ): Promise<TCaseClusterAnalysis> {
    return this.post(
      `${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/${analysisId}/clusters/${clusterId}/split/`,
      data
    )
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async reclassifyItem(
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    itemId: string,
    clusterId: string
  ): Promise<TCaseClusterAnalysis> {
    return this.patch(
      `${this.basePath(workspaceSlug, projectId)}/case-cluster-analyses/${analysisId}/items/${itemId}/`,
      { cluster_id: clusterId }
    )
      .then((response) => response.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
