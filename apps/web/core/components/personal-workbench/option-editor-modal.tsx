import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import type {
  TPersonalWorkbenchField,
  TPersonalWorkbenchOption,
  TPersonalWorkbenchTable,
} from "@/types/personal-workbench";

type TOptionEditorModalProps = {
  isOpen: boolean;
  table: TPersonalWorkbenchTable | undefined;
  field: TPersonalWorkbenchField | null;
  saving: boolean;
  onClose: () => void;
  onSave: (options: TPersonalWorkbenchOption[]) => Promise<void>;
};

export function OptionEditorModal({ isOpen, table, field, saving, onClose, onSave }: TOptionEditorModalProps) {
  const [options, setOptions] = useState<TPersonalWorkbenchOption[]>([]);

  useEffect(() => {
    if (!isOpen || !field) return;
    setOptions(
      field.options
        .filter((option) => option.name.trim())
        .map((option) => ({ id: option.id, name: option.name, color: option.color }))
    );
  }, [field, isOpen]);

  const hasInvalidOption = useMemo(() => {
    const names = options.map((option) => option.name.trim().toLowerCase());
    return names.some((name) => !name) || new Set(names).size !== names.length;
  }, [options]);

  const addOption = () => {
    setOptions((current) => [...current, { id: `new-${crypto.randomUUID()}`, name: "", color: null }]);
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="flex max-h-[72vh] flex-col bg-white text-[#252f49]">
        <div className="h-1 shrink-0 bg-[#ffc928]" />
        <div className="flex items-center justify-between border-b border-[#eceef1] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-16 font-semibold text-[#252f49]">编辑“{field?.name || "下拉"}”选项</h2>
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
            {options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2">
                <input
                  value={option.name}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((currentOption) =>
                        currentOption.id === option.id ? { ...currentOption, name: event.target.value } : currentOption
                      )
                    )
                  }
                  placeholder="输入选项名称"
                  maxLength={100}
                  className="h-9 min-w-0 flex-1 rounded-md border border-[#e3e5e9] bg-white px-3 text-13 text-[#2b3448] outline-none placeholder:text-[#b4bac4] focus:border-[#f0bc16] focus:ring-2 focus:ring-[#fff2b5]"
                />
                <button
                  type="button"
                  title="删除选项"
                  aria-label={`删除选项 ${option.name || index + 1}`}
                  onClick={() => setOptions((current) => current.filter((item) => item.id !== option.id))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#a0a7b2] hover:bg-[#fff0f0] hover:text-[#d9363e]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-3 flex h-9 items-center rounded-md border border-[#efd068] bg-[#fff9df] px-3 text-13 font-medium text-[#7d5e00] hover:bg-[#fff3b8]"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加选项
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eceef1] bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-md border border-[#e3e5e9] px-4 text-13 font-medium text-[#606979] hover:bg-[#f5f6f7] disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() =>
              void onSave(options.map((option) => ({ id: option.id, name: option.name.trim(), color: option.color })))
            }
            disabled={saving || hasInvalidOption}
            className="h-9 rounded-md bg-[#ffc928] px-4 text-13 font-medium text-[#252f49] shadow-[0_2px_8px_rgba(217,162,11,0.2)] hover:bg-[#f5bd12] disabled:opacity-50"
          >
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </div>
    </ModalCore>
  );
}
