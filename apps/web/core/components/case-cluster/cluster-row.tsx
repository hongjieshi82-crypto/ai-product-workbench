/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Combine, Save, Split } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TCaseCluster, TCaseClusterCategory, TCaseClusterUpdate } from "@plane/types";
import { Tooltip } from "@plane/ui";
import { useCaseCluster } from "@/hooks/store/use-case-cluster";

const CATEGORY_OPTIONS: { value: TCaseClusterCategory; label: string }[] = [
  { value: "scene", label: "场景" },
  { value: "requirement", label: "需求" },
  { value: "badcase", label: "Badcase" },
  { value: "opportunity", label: "机会点" },
];

type TClusterRowProps = {
  cluster: TCaseCluster;
  activeClusters: TCaseCluster[];
  workspaceSlug: string;
  projectId: string;
  analysisId: string;
  canManage: boolean;
};

export const CaseClusterRow = observer(function CaseClusterRow(props: TClusterRowProps) {
  const { cluster, activeClusters, workspaceSlug, projectId, analysisId, canManage } = props;
  const { updateCluster, mergeClusters, splitCluster, reclassifyItem } = useCaseCluster();
  const [draft, setDraft] = useState<TCaseClusterUpdate>({
    category: cluster.category,
    name: cluster.name,
    summary: cluster.summary,
    typical_feedback: cluster.typical_feedback,
    product_opportunity: cluster.product_opportunity,
  });
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft({
      category: cluster.category,
      name: cluster.name,
      summary: cluster.summary,
      typical_feedback: cluster.typical_feedback,
      product_opportunity: cluster.product_opportunity,
    });
    setSelectedIssueIds((current) =>
      current.filter((issueId) => cluster.items.some((item) => item.issue_id === issueId))
    );
  }, [cluster]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCluster(workspaceSlug, projectId, analysisId, cluster.id, draft);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已保存", message: "聚类内容已更新。" });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "保存失败",
        message: (error as { error?: string })?.error || "无法更新聚类。",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeTargetId) return;
    try {
      await mergeClusters(workspaceSlug, projectId, analysisId, mergeTargetId, [cluster.id]);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已合并", message: "原聚类记录已保留。" });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "合并失败",
        message: (error as { error?: string })?.error || "无法合并聚类。",
      });
    }
  };

  const handleSplit = async () => {
    if (selectedIssueIds.length === 0 || selectedIssueIds.length >= cluster.items.length) return;
    try {
      await splitCluster(workspaceSlug, projectId, analysisId, cluster.id, {
        name: `${cluster.name} - 拆分`,
        category: cluster.category,
        issue_ids: selectedIssueIds,
        summary: cluster.summary,
      });
      setSelectedIssueIds([]);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已拆分", message: "选中事项已形成新聚类。" });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "拆分失败",
        message: (error as { error?: string })?.error || "无法拆分聚类。",
      });
    }
  };

  const handleReclassify = async (itemId: string, targetClusterId: string) => {
    if (!targetClusterId || targetClusterId === cluster.id) return;
    try {
      await reclassifyItem(workspaceSlug, projectId, analysisId, itemId, targetClusterId);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "归类失败",
        message: (error as { error?: string })?.error || "无法移动事项。",
      });
    }
  };

  const fieldClassName =
    "min-h-20 w-full resize-y border-0 bg-transparent px-3 py-2 text-12 leading-5 text-primary outline-none focus:bg-surface-2";

  return (
    <section className="border-b border-subtle">
      <div className="grid grid-cols-[124px_220px_minmax(200px,1fr)_minmax(200px,1fr)_minmax(200px,1fr)_128px] divide-x divide-subtle">
        <div className="p-2">
          <select
            value={draft.category}
            disabled={!canManage}
            onChange={(event) =>
              setDraft((current) => ({ ...current, category: event.target.value as TCaseClusterCategory }))
            }
            className="h-8 w-full rounded-sm border border-subtle bg-surface-1 px-2 text-12 text-primary outline-none"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          aria-label="聚类名称"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          maxLength={255}
          disabled={!canManage}
          className={fieldClassName}
        />
        <textarea
          aria-label="摘要"
          value={draft.summary}
          disabled={!canManage}
          onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
          className={fieldClassName}
        />
        <textarea
          aria-label="典型反馈"
          value={draft.typical_feedback}
          disabled={!canManage}
          onChange={(event) => setDraft((current) => ({ ...current, typical_feedback: event.target.value }))}
          className={fieldClassName}
        />
        <textarea
          aria-label="产品机会"
          value={draft.product_opportunity}
          disabled={!canManage}
          onChange={(event) => setDraft((current) => ({ ...current, product_opportunity: event.target.value }))}
          className={fieldClassName}
        />
        <div className="flex flex-col gap-2 p-2">
          <Tooltip tooltipContent="保存修改" position="left">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canManage || isSaving || !draft.name.trim()}
              className="flex h-8 items-center justify-center gap-1.5 rounded-sm border border-subtle text-12 text-primary hover:bg-layer-1 disabled:opacity-50"
            >
              <Save className="size-3.5" /> 保存
            </button>
          </Tooltip>
          <div className="flex gap-1">
            <select
              aria-label="合并目标"
              value={mergeTargetId}
              disabled={!canManage}
              onChange={(event) => setMergeTargetId(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-sm border border-subtle bg-surface-1 px-1 text-11 text-primary outline-none"
            >
              <option value="">合并到</option>
              {activeClusters
                .filter((item) => item.id !== cluster.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <Tooltip tooltipContent="合并到所选聚类" position="left">
              <button
                type="button"
                onClick={handleMerge}
                disabled={!canManage || !mergeTargetId}
                aria-label="合并"
                className="flex size-8 flex-shrink-0 items-center justify-center rounded-sm border border-subtle text-tertiary hover:bg-layer-1 hover:text-primary disabled:opacity-40"
              >
                <Combine className="size-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="border-t border-subtle bg-surface-2/40">
        <div className="grid grid-cols-[36px_110px_minmax(260px,1fr)_180px] items-center px-3 py-1.5 text-11 font-medium text-tertiary">
          <Tooltip tooltipContent="拆分选中事项" position="right">
            <button
              type="button"
              onClick={handleSplit}
              disabled={!canManage || selectedIssueIds.length === 0 || selectedIssueIds.length >= cluster.items.length}
              aria-label="拆分选中事项"
              className="flex size-6 items-center justify-center rounded-sm hover:bg-layer-1 disabled:opacity-30"
            >
              <Split className="size-3.5" />
            </button>
          </Tooltip>
          <span>包含事项</span>
          <span>{cluster.items.length} 项</span>
          <span>重新归类</span>
        </div>
        {cluster.items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[36px_110px_minmax(260px,1fr)_180px] items-center border-t border-subtle px-3 py-2 text-12"
          >
            <input
              type="checkbox"
              checked={selectedIssueIds.includes(item.issue_id)}
              disabled={!canManage}
              onChange={() =>
                setSelectedIssueIds((current) =>
                  current.includes(item.issue_id)
                    ? current.filter((issueId) => issueId !== item.issue_id)
                    : [...current, item.issue_id]
                )
              }
              className="accent-accent-primary size-3.5"
            />
            <span className="text-tertiary">{item.source_snapshot.identifier}</span>
            <div className="min-w-0 pr-4">
              <span className="block truncate font-medium text-primary">{item.source_snapshot.name}</span>
              {item.source_snapshot.description && (
                <div className="mt-0.5 truncate text-11 text-tertiary">{item.source_snapshot.description}</div>
              )}
            </div>
            <select
              aria-label={`重新归类 ${item.source_snapshot.identifier}`}
              value={cluster.id}
              disabled={!canManage}
              onChange={(event) => void handleReclassify(item.id, event.target.value)}
              className="h-7 w-full rounded-sm border border-subtle bg-surface-1 px-2 text-11 text-primary outline-none"
            >
              {activeClusters.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
});
