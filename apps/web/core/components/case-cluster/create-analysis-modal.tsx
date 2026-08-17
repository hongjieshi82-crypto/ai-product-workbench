/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { Search, X } from "lucide-react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { useCaseCluster } from "@/hooks/store/use-case-cluster";

type TCreateAnalysisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
};

export const CreateCaseClusterAnalysisModal = observer(function CreateCaseClusterAnalysisModal(
  props: TCreateAnalysisModalProps
) {
  const { isOpen, onClose, workspaceSlug, projectId } = props;
  const { candidates, fetchCandidates, createAnalysis, isMutating } = useCaseCluster();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchCandidates(workspaceSlug, projectId).catch(() => {
      setToast({ type: TOAST_TYPE.ERROR, title: "加载失败", message: "无法加载可分析事项。" });
    });
  }, [fetchCandidates, isOpen, projectId, workspaceSlug]);

  useEffect(() => {
    if (isOpen) return;
    setName("");
    setSearch("");
    setSelectedIds([]);
  }, [isOpen]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(query) ||
        candidate.identifier.toLowerCase().includes(query) ||
        candidate.description.toLowerCase().includes(query)
    );
  }, [candidates, search]);

  const toggleItem = (issueId: string) => {
    setSelectedIds((current) =>
      current.includes(issueId) ? current.filter((id) => id !== issueId) : [...current, issueId]
    );
  };

  const handleCreate = async () => {
    try {
      await createAnalysis(workspaceSlug, projectId, { name: name.trim() || undefined, issue_ids: selectedIds });
      setToast({ type: TOAST_TYPE.SUCCESS, title: "分析完成", message: "已生成 Case 聚类。" });
      onClose();
    } catch (error) {
      const message = (error as { error?: string })?.error || "AI 聚类失败，请检查模型配置后重试。";
      setToast({ type: TOAST_TYPE.ERROR, title: "分析失败", message });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXXXL}>
      <div className="flex max-h-[82vh] flex-col bg-surface-1">
        <div className="flex items-start justify-between border-b border-subtle px-6 py-4">
          <div>
            <h2 className="text-16 font-semibold text-primary">新建 Case 聚类分析</h2>
            <p className="mt-1 text-12 text-tertiary">已选择 {selectedIds.length} 项，单次最多 100 项</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-sm text-tertiary hover:bg-layer-1 hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-subtle px-6 py-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="分析名称（可选）"
            maxLength={255}
            className="focus:border-accent-primary h-9 rounded-sm border border-subtle bg-surface-1 px-3 text-13 text-primary outline-none"
          />
          <label className="flex h-9 items-center gap-2 rounded-sm border border-subtle bg-surface-1 px-3">
            <Search className="size-4 text-placeholder" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、编号或描述"
              className="min-w-0 flex-1 bg-transparent text-13 text-primary outline-none"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="sticky top-0 grid grid-cols-[36px_100px_minmax(220px,1fr)_160px] border-b border-subtle bg-surface-1 py-2 text-11 font-medium text-tertiary">
            <span />
            <span>编号</span>
            <span>事项</span>
            <span>类型 / 标签</span>
          </div>
          {filteredCandidates.map((candidate) => (
            <label
              key={candidate.id}
              className="grid cursor-pointer grid-cols-[36px_100px_minmax(220px,1fr)_160px] items-center border-b border-subtle py-2.5 text-12 hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(candidate.id)}
                onChange={() => toggleItem(candidate.id)}
                disabled={!selectedIds.includes(candidate.id) && selectedIds.length >= 100}
                className="accent-accent-primary size-4"
              />
              <span className="text-tertiary">{candidate.identifier}</span>
              <span className="min-w-0 truncate pr-4 font-medium text-primary">{candidate.name}</span>
              <span className="truncate text-tertiary">
                {[candidate.type, ...candidate.labels].filter(Boolean).join(" · ") || "-"}
              </span>
            </label>
          ))}
          {filteredCandidates.length === 0 && (
            <div className="flex h-32 items-center justify-center text-13 text-tertiary">没有匹配事项</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-subtle px-6 py-4">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isMutating}>
            取消
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleCreate}
            loading={isMutating}
            disabled={selectedIds.length < 2}
          >
            生成聚类
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
