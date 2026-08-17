/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TCaseClusterCategory = "scene" | "requirement" | "badcase" | "opportunity";
export type TCaseClusterAnalysisStatus = "processing" | "ready" | "failed";

export type TCaseClusterSourceSnapshot = {
  id: string;
  identifier: string;
  name: string;
  description: string;
  priority: string;
  state: string;
  type: string;
  labels: string[];
};

export type TCaseClusterItem = {
  id: string;
  issue_id: string;
  cluster_id: string;
  source_snapshot: TCaseClusterSourceSnapshot;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TCaseCluster = {
  id: string;
  analysis_id: string;
  category: TCaseClusterCategory;
  name: string;
  summary: string;
  typical_feedback: string;
  product_opportunity: string;
  sort_order: number;
  merged_into_id: string | null;
  items: TCaseClusterItem[];
  created_at: string;
  updated_at: string;
};

export type TCaseClusterAnalysis = {
  id: string;
  name: string;
  status: TCaseClusterAnalysisStatus;
  model_name: string;
  source_count: number;
  error: string;
  clusters: TCaseCluster[];
  created_at: string;
  updated_at: string;
};

export type TCaseClusterCandidate = TCaseClusterSourceSnapshot;

export type TCaseClusterUpdate = Pick<
  TCaseCluster,
  "category" | "name" | "summary" | "typical_feedback" | "product_opportunity"
>;
