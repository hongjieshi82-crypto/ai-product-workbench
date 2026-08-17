/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import { AlertCircle, LoaderCircle, ScanSearch } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useCaseCluster } from "@/hooks/store/use-case-cluster";
import { CaseClusterRow } from "./cluster-row";

type TCaseClusterRootProps = {
  workspaceSlug: string;
  projectId: string;
  onCreate: () => void;
};

export const CaseClusterRoot = observer(function CaseClusterRoot(props: TCaseClusterRootProps) {
  const { workspaceSlug, projectId, onCreate } = props;
  const { analyses, selectedAnalysisId, selectAnalysis, fetchAnalyses, isLoading } = useCaseCluster();
  const canManage = true;

  useEffect(() => {
    void fetchAnalyses(workspaceSlug, projectId).catch((error) => {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "加载失败",
        message: (error as { error?: string })?.error || "无法加载 Case 聚类分析。",
      });
    });
  }, [fetchAnalyses, projectId, workspaceSlug]);

  const selectedAnalysis = analyses.find((analysis) => analysis.id === selectedAnalysisId) ?? null;
  const activeClusters = useMemo(
    () => selectedAnalysis?.clusters.filter((cluster) => !cluster.merged_into_id) ?? [],
    [selectedAnalysis]
  );

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center text-tertiary">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-subtle bg-surface-1">
        <div className="sticky top-0 border-b border-subtle bg-surface-1 px-4 py-3 text-11 font-semibold text-tertiary">
          分析记录
        </div>
        {analyses.map((analysis) => (
          <button
            key={analysis.id}
            type="button"
            onClick={() => selectAnalysis(analysis.id)}
            className={`w-full border-b border-subtle px-4 py-3 text-left hover:bg-surface-2 ${
              analysis.id === selectedAnalysisId ? "bg-layer-1" : ""
            }`}
          >
            <div className="truncate text-12 font-medium text-primary">{analysis.name}</div>
            <div className="mt-1 flex items-center justify-between text-11 text-tertiary">
              <span>{analysis.source_count} 项</span>
              <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        {!selectedAnalysis ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <ScanSearch className="size-8 text-placeholder" />
            <div className="text-14 font-medium text-primary">暂无 Case 聚类分析</div>
            {canManage && (
              <Button variant="primary" size="lg" onClick={onCreate}>
                新建分析
              </Button>
            )}
          </div>
        ) : selectedAnalysis.status === "failed" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <AlertCircle className="text-red-500 size-7" />
            <div className="text-14 font-medium text-primary">本次分析失败</div>
            <div className="max-w-xl text-12 text-tertiary">{selectedAnalysis.error}</div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-[1] flex h-12 items-center justify-between border-b border-subtle bg-surface-1 px-4">
              <div className="min-w-0">
                <div className="truncate text-13 font-semibold text-primary">{selectedAnalysis.name}</div>
                <div className="text-11 text-tertiary">
                  {activeClusters.length} 个聚类 · {selectedAnalysis.source_count} 个原始事项
                </div>
              </div>
              <div className="text-11 text-tertiary">{selectedAnalysis.model_name}</div>
            </div>
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[124px_220px_minmax(200px,1fr)_minmax(200px,1fr)_minmax(200px,1fr)_128px] divide-x divide-subtle border-b border-subtle bg-surface-2 text-11 font-semibold text-tertiary">
                <div className="px-3 py-2">分类</div>
                <div className="px-3 py-2">名称</div>
                <div className="px-3 py-2">摘要</div>
                <div className="px-3 py-2">典型反馈</div>
                <div className="px-3 py-2">产品机会</div>
                <div className="px-3 py-2">操作</div>
              </div>
              {activeClusters.map((cluster) => (
                <CaseClusterRow
                  key={cluster.id}
                  cluster={cluster}
                  activeClusters={activeClusters}
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  analysisId={selectedAnalysis.id}
                  canManage={canManage}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
});
