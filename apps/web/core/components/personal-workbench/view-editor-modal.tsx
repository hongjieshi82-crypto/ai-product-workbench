import { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import type { TPersonalWorkbenchTable, TPersonalWorkbenchView } from "@/types/personal-workbench";

export type TPersonalWorkbenchViewSettings = {
  hiddenViewIds: string[];
  renamedViewNames: Record<string, string>;
  customViews: TPersonalWorkbenchView[];
};

type TEditableView = {
  id: string;
  name: string;
  isCustom: boolean;
  hidden: boolean;
};

type TViewEditorModalProps = {
  isOpen: boolean;
  table: TPersonalWorkbenchTable | undefined;
  settings: TPersonalWorkbenchViewSettings;
  onClose: () => void;
  onSave: (settings: TPersonalWorkbenchViewSettings) => void;
};

export function ViewEditorModal({ isOpen, table, settings, onClose, onSave }: TViewEditorModalProps) {
  const [views, setViews] = useState<TEditableView[]>([]);

  useEffect(() => {
    if (!isOpen || !table) return;
    setViews([
      ...table.views.map((view) => ({
        id: view.id,
        name: settings.renamedViewNames[view.id] || view.name,
        isCustom: false,
        hidden: settings.hiddenViewIds.includes(view.id),
      })),
      ...settings.customViews.map((view) => ({ id: view.id, name: view.name, isCustom: true, hidden: false })),
    ]);
  }, [isOpen, settings, table]);

  const visibleViews = views.filter((view) => !view.hidden);
  const hiddenViews = views.filter((view) => view.hidden);
  const hasInvalidView = useMemo(() => {
    const names = visibleViews.map((view) => view.name.trim().toLowerCase());
    return names.length === 0 || names.some((name) => !name) || new Set(names).size !== names.length;
  }, [visibleViews]);

  const addView = () => {
    setViews((current) => [
      ...current,
      { id: `custom-${crypto.randomUUID()}`, name: "", isCustom: true, hidden: false },
    ]);
  };

  const removeView = (view: TEditableView) => {
    setViews((current) =>
      view.isCustom
        ? current.filter((currentView) => currentView.id !== view.id)
        : current.map((currentView) =>
            currentView.id === view.id
              ? {
                  id: currentView.id,
                  name: currentView.name,
                  isCustom: currentView.isCustom,
                  hidden: true,
                }
              : currentView
          )
    );
  };

  const save = () => {
    if (!table || hasInvalidView) return;
    const originalViewIds = new Set(table.views.map((view) => view.id));
    const templateView = table.views[0];
    onSave({
      hiddenViewIds: views.filter((view) => !view.isCustom && view.hidden).map((view) => view.id),
      renamedViewNames: Object.fromEntries(
        views.filter((view) => originalViewIds.has(view.id)).map((view) => [view.id, view.name.trim()])
      ),
      customViews: views
        .filter((view) => view.isCustom && !view.hidden)
        .map((view) => {
          const existing = settings.customViews.find((customView) => customView.id === view.id);
          return {
            id: view.id,
            name: view.name.trim(),
            type: existing?.type || 1,
            fields: existing?.fields || templateView?.fields || table.fields.map((field) => field.id),
            source_record_ids: [],
            col_infos: existing?.col_infos || {},
            frozen_col_count: existing?.frozen_col_count ?? 1,
          };
        }),
    });
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="flex max-h-[72vh] flex-col bg-white text-[#252f49]">
        <div className="h-1 shrink-0 bg-[#ffc928]" />
        <div className="flex items-center justify-between border-b border-[#eceef1] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-16 font-semibold text-[#252f49]">管理视图</h2>
            <div className="mt-1 truncate text-12 text-[#9299a6]">{table?.name}</div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8c94a3] hover:bg-[#f3f4f6] hover:text-[#252f49]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafbfc] px-5 py-4">
          <div className="space-y-2">
            {visibleViews.map((view, index) => (
              <div key={view.id} className="flex items-center gap-2">
                <input
                  value={view.name}
                  onChange={(event) =>
                    setViews((current) =>
                      current.map((currentView) =>
                        currentView.id === view.id
                          ? {
                              id: currentView.id,
                              name: event.target.value,
                              isCustom: currentView.isCustom,
                              hidden: currentView.hidden,
                            }
                          : currentView
                      )
                    )
                  }
                  placeholder="输入视图名称"
                  maxLength={50}
                  className="h-9 min-w-0 flex-1 rounded-md border border-[#e3e5e9] bg-white px-3 text-13 text-[#2b3448] outline-none placeholder:text-[#b4bac4] focus:border-[#f0bc16] focus:ring-2 focus:ring-[#fff2b5]"
                />
                <button
                  type="button"
                  title={view.isCustom ? "删除视图" : "隐藏视图"}
                  aria-label={`${view.isCustom ? "删除" : "隐藏"}视图 ${view.name || index + 1}`}
                  onClick={() => removeView(view)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#a0a7b2] hover:bg-[#fff0f0] hover:text-[#d9363e]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addView}
            className="mt-3 flex h-9 items-center rounded-md border border-[#efd068] bg-[#fff9df] px-3 text-13 font-medium text-[#7d5e00] hover:bg-[#fff3b8]"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加视图
          </button>

          {hiddenViews.length > 0 && (
            <div className="mt-5 border-t border-[#eceef1] pt-4">
              <div className="mb-2 text-12 font-medium text-[#9299a6]">已隐藏</div>
              <div className="space-y-1">
                {hiddenViews.map((view) => (
                  <div key={view.id} className="flex h-9 items-center justify-between px-2 text-13 text-[#7d8593]">
                    <span className="truncate">{view.name}</span>
                    <button
                      type="button"
                      title="恢复视图"
                      aria-label={`恢复视图 ${view.name}`}
                      onClick={() =>
                        setViews((current) =>
                          current.map((currentView) =>
                            currentView.id === view.id
                              ? {
                                  id: currentView.id,
                                  name: currentView.name,
                                  isCustom: currentView.isCustom,
                                  hidden: false,
                                }
                              : currentView
                          )
                        )
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#8c94a3] hover:bg-[#fff4c2] hover:text-[#9b7400]"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eceef1] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#e3e5e9] px-4 text-13 font-medium text-[#606979] hover:bg-[#f5f6f7]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={hasInvalidView}
            className="h-9 rounded-md bg-[#ffc928] px-4 text-13 font-medium text-[#252f49] shadow-[0_2px_8px_rgba(217,162,11,0.2)] hover:bg-[#f5bd12] disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </ModalCore>
  );
}
