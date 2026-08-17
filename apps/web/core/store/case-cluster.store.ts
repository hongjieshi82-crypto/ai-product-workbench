/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
import type {
  TCaseClusterAnalysis,
  TCaseClusterCandidate,
  TCaseClusterCategory,
  TCaseClusterUpdate,
} from "@plane/types";
import { CaseClusterService } from "@/services/case-cluster.service";

export interface ICaseClusterStore {
  analyses: TCaseClusterAnalysis[];
  candidates: TCaseClusterCandidate[];
  selectedAnalysisId: string | null;
  isLoading: boolean;
  isMutating: boolean;
  fetchAnalyses: (workspaceSlug: string, projectId: string) => Promise<TCaseClusterAnalysis[]>;
  fetchCandidates: (workspaceSlug: string, projectId: string, search?: string) => Promise<TCaseClusterCandidate[]>;
  selectAnalysis: (analysisId: string | null) => void;
  createAnalysis: (
    workspaceSlug: string,
    projectId: string,
    data: { name?: string; issue_ids: string[] }
  ) => Promise<TCaseClusterAnalysis>;
  updateCluster: (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: Partial<TCaseClusterUpdate>
  ) => Promise<TCaseClusterAnalysis>;
  mergeClusters: (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    targetClusterId: string,
    sourceClusterIds: string[]
  ) => Promise<TCaseClusterAnalysis>;
  splitCluster: (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: { name: string; category: TCaseClusterCategory; issue_ids: string[]; summary?: string }
  ) => Promise<TCaseClusterAnalysis>;
  reclassifyItem: (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    itemId: string,
    clusterId: string
  ) => Promise<TCaseClusterAnalysis>;
}

export class CaseClusterStore implements ICaseClusterStore {
  analyses: TCaseClusterAnalysis[] = [];
  candidates: TCaseClusterCandidate[] = [];
  selectedAnalysisId: string | null = null;
  isLoading = false;
  isMutating = false;
  private service = new CaseClusterService();

  constructor() {
    makeObservable(this, {
      analyses: observable.ref,
      candidates: observable.ref,
      selectedAnalysisId: observable,
      isLoading: observable,
      isMutating: observable,
      fetchAnalyses: action,
      fetchCandidates: action,
      selectAnalysis: action,
      createAnalysis: action,
      updateCluster: action,
      mergeClusters: action,
      splitCluster: action,
      reclassifyItem: action,
    });
  }

  private applyAnalysis = (analysis: TCaseClusterAnalysis) => {
    const existingIndex = this.analyses.findIndex((item) => item.id === analysis.id);
    this.analyses =
      existingIndex === -1
        ? [analysis, ...this.analyses]
        : this.analyses.map((item) => (item.id === analysis.id ? analysis : item));
    this.selectedAnalysisId = analysis.id;
    return analysis;
  };

  fetchAnalyses = async (workspaceSlug: string, projectId: string) => {
    this.isLoading = true;
    try {
      const analyses = await this.service.getAnalyses(workspaceSlug, projectId);
      runInAction(() => {
        this.analyses = analyses;
        if (!this.selectedAnalysisId || !analyses.some((item) => item.id === this.selectedAnalysisId)) {
          this.selectedAnalysisId = analyses[0]?.id ?? null;
        }
      });
      return analyses;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  };

  fetchCandidates = async (workspaceSlug: string, projectId: string, search = "") => {
    const candidates = await this.service.getCandidates(workspaceSlug, projectId, search);
    runInAction(() => {
      this.candidates = candidates;
    });
    return candidates;
  };

  selectAnalysis = (analysisId: string | null) => {
    this.selectedAnalysisId = analysisId;
  };

  createAnalysis = async (workspaceSlug: string, projectId: string, data: { name?: string; issue_ids: string[] }) => {
    this.isMutating = true;
    try {
      const analysis = await this.service.createAnalysis(workspaceSlug, projectId, data);
      return runInAction(() => this.applyAnalysis(analysis));
    } finally {
      runInAction(() => {
        this.isMutating = false;
      });
    }
  };

  updateCluster = async (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: Partial<TCaseClusterUpdate>
  ) => {
    const analysis = await this.service.updateCluster(workspaceSlug, projectId, analysisId, clusterId, data);
    return runInAction(() => this.applyAnalysis(analysis));
  };

  mergeClusters = async (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    targetClusterId: string,
    sourceClusterIds: string[]
  ) => {
    const analysis = await this.service.mergeClusters(workspaceSlug, projectId, analysisId, {
      target_cluster_id: targetClusterId,
      source_cluster_ids: sourceClusterIds,
    });
    return runInAction(() => this.applyAnalysis(analysis));
  };

  splitCluster = async (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    clusterId: string,
    data: { name: string; category: TCaseClusterCategory; issue_ids: string[]; summary?: string }
  ) => {
    const analysis = await this.service.splitCluster(workspaceSlug, projectId, analysisId, clusterId, data);
    return runInAction(() => this.applyAnalysis(analysis));
  };

  reclassifyItem = async (
    workspaceSlug: string,
    projectId: string,
    analysisId: string,
    itemId: string,
    clusterId: string
  ) => {
    const analysis = await this.service.reclassifyItem(workspaceSlug, projectId, analysisId, itemId, clusterId);
    return runInAction(() => this.applyAnalysis(analysis));
  };
}
