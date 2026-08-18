import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { PersonalWorkbenchService } from "@/services/personal-workbench.service";
import type {
  TPersonalWorkbenchAISuggestion,
  TPersonalWorkbenchField,
  TPersonalWorkbenchItem,
  TPersonalWorkbenchTable,
} from "@/types/personal-workbench";

const workbenchService = new PersonalWorkbenchService();

const AI_TABLE_KEYS = new Set([
  "product-goals",
  "personal-tasks",
  "scenarios",
  "requirements",
  "functions",
  "iterations",
  "bugs",
  "badcases",
]);

type TAIWorkbenchEntryProps = {
  tables: TPersonalWorkbenchTable[];
  onCreated: (tableKey: string, item: TPersonalWorkbenchItem) => void;
  onError: (message: string) => void;
};

type TDraftFieldProps = {
  field: TPersonalWorkbenchField;
  value: unknown;
  onChange: (value: unknown) => void;
};

const valueText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("、");
  return String(value);
};

function DraftField({ field, value, onChange }: TDraftFieldProps) {
  const isDate = field.type === 5 || field.ui_type.toLowerCase().includes("date");
  const isCheckbox = field.type === 7 || field.ui_type.toLowerCase().includes("checkbox");
  const isLongText = /描述|背景|痛点|备注|总结|输出|问题/.test(field.name);

  if (isCheckbox) {
    const checked = value === true || ["true", "1", "是", "已完成"].includes(String(value ?? "").toLowerCase());
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full border transition-colors ${
          checked ? "border-[#ffc928] bg-[#ffc928]" : "border-[#c9cdd3] bg-[#eceef1]"
        }`}
      >
        <span
          className={`absolute top-px left-px h-5 w-5 rounded-full shadow-[0_1px_4px_rgba(37,47,73,0.24)] transition-all ${
            checked ? "translate-x-5 bg-white" : "bg-[#aeb4bd]"
          }`}
        />
      </button>
    );
  }

  if (field.options.length > 0 && !field.multiple) {
    return (
      <select
        value={valueText(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-[#dfe2e7] bg-white px-3 text-13 text-[#2b3448] outline-none focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
      >
        <option value="">未选择</option>
        {field.options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  if (isLongText) {
    return (
      <textarea
        value={valueText(value)}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="min-h-20 w-full resize-y rounded-md border border-[#dfe2e7] bg-white px-3 py-2 text-13 text-[#2b3448] outline-none focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
      />
    );
  }

  return (
    <input
      type={isDate ? "date" : "text"}
      value={valueText(value)}
      onChange={(event) =>
        onChange(field.multiple ? event.target.value.split(/[、,，]/).map((item) => item.trim()) : event.target.value)
      }
      className="h-9 w-full rounded-md border border-[#dfe2e7] bg-white px-3 text-13 text-[#2b3448] outline-none focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
    />
  );
}

export function AIWorkbenchEntry({ tables, onCreated, onError }: TAIWorkbenchEntryProps) {
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<TPersonalWorkbenchAISuggestion | null>(null);
  const [targetKey, setTargetKey] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});

  const availableTables = useMemo(() => tables.filter((table) => AI_TABLE_KEYS.has(table.key)), [tables]);
  const targetTable = availableTables.find((table) => table.key === targetKey);

  useEffect(() => {
    if (!suggestion) return;
    setTargetKey(suggestion.table_key);
    setValues(suggestion.values);
  }, [suggestion]);

  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || analyzing) return;
    setAnalyzing(true);
    try {
      setSuggestion(await workbenchService.analyzeNaturalLanguage(text));
    } catch (error) {
      onError((error as { error?: string })?.error || "这次没有整理成功，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  };

  const changeTarget = (nextKey: string) => {
    const previousTable = targetTable;
    const nextTable = availableTables.find((table) => table.key === nextKey);
    if (!nextTable) return;
    const previousByName = new Map<string, unknown>();
    previousTable?.fields.forEach((field) => {
      if (values[field.id] !== undefined) previousByName.set(field.name, values[field.id]);
    });
    const previousTitle = previousTable ? values[previousTable.primary_field_id] : "";
    const nextValues = Object.fromEntries(
      nextTable.fields
        .map((field) => [field.id, previousByName.get(field.name)] as const)
        .filter(([, value]) => value !== undefined)
    );
    nextValues[nextTable.primary_field_id] = previousTitle || suggestion?.source_text.slice(0, 80) || "";
    setTargetKey(nextKey);
    setValues(nextValues);
  };

  const close = () => {
    if (saving) return;
    setSuggestion(null);
  };

  const confirm = async () => {
    if (!targetTable || !suggestion || saving) return;
    setSaving(true);
    try {
      const item = await workbenchService.createItem(targetTable.key, values, suggestion.source_text);
      onCreated(targetTable.key, item);
      setInput("");
      setSuggestion(null);
    } catch (error) {
      onError((error as { error?: string })?.error || "保存失败，请检查内容后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-[#e8e9ec] bg-[#fffdf7] px-7">
        <form onSubmit={analyze} className="flex w-full items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Sparkles className="absolute top-2.5 left-3 h-4 w-4 text-[#c49300]" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={6000}
              placeholder="把刚想到的需求、反馈、任务或问题写在这里"
              className="h-9 w-full rounded-md border border-[#eadb9f] bg-white pr-3 pl-9 text-13 text-[#2b3448] outline-none placeholder:text-[#a8aeb8] focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || analyzing}
            className="flex h-9 shrink-0 items-center rounded-md bg-[#252f49] px-4 text-13 font-medium text-white hover:bg-[#313d5b] disabled:opacity-45"
          >
            {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {analyzing ? "整理中" : "AI 整理"}
          </button>
        </form>
      </div>

      <ModalCore
        isOpen={Boolean(suggestion)}
        handleClose={close}
        position={EModalPosition.CENTER}
        width={EModalWidth.XXXXL}
      >
        <div className="flex max-h-[84vh] flex-col bg-white text-[#252f49]">
          <div className="h-1 shrink-0 bg-[#ffc928]" />
          <div className="flex items-start justify-between border-b border-[#eceef1] px-6 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-16 font-semibold">整理结果</h2>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    suggestion?.mode === "ai" ? "bg-[#e8f5e9] text-[#2f6b37]" : "bg-[#fff4c2] text-[#7d5e00]"
                  }`}
                >
                  {suggestion?.mode === "ai" ? "AI 识别" : "本机识别"}
                </span>
              </div>
              <p className="mt-1 text-12 text-[#7d8593]">{suggestion?.reason}</p>
            </div>
            <button
              type="button"
              title="关闭"
              aria-label="关闭"
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#8c94a3] hover:bg-[#f3f4f6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafbfc] px-6 py-5">
            {suggestion?.notice && (
              <div className="mb-4 rounded-md border border-[#efd068] bg-[#fff9df] px-3 py-2 text-12 text-[#7d5e00]">
                {suggestion.notice}
              </div>
            )}
            <div className="mb-5 grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3">
              <label htmlFor="ai-target-table" className="text-13 font-medium text-[#606979]">
                添加到
              </label>
              <select
                id="ai-target-table"
                value={targetKey}
                onChange={(event) => changeTarget(event.target.value)}
                className="h-9 rounded-md border border-[#dfe2e7] bg-white px-3 text-13 font-medium text-[#252f49] outline-none focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
              >
                {availableTables.map((table) => (
                  <option key={table.id} value={table.key}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {targetTable?.fields
                .filter((field) => !field.readonly)
                .map((field) => (
                  <div key={field.id} className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3">
                    <label className="pt-2 text-13 font-medium text-[#606979]">{field.name}</label>
                    <DraftField
                      field={field}
                      value={values[field.id]}
                      onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
                    />
                  </div>
                ))}
            </div>

            <div className="mt-5 border-t border-[#e5e7eb] pt-4">
              <div className="mb-2 text-12 font-medium text-[#7d8593]">原始输入</div>
              <div className="rounded-md border border-[#e4e6e9] bg-white px-3 py-2 text-12 leading-5 whitespace-pre-wrap text-[#697283]">
                {suggestion?.source_text}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#eceef1] px-6 py-4">
            <span className="flex items-center text-12 text-[#9299a6]">
              <Check className="mr-1.5 h-3.5 w-3.5 text-[#5b8f4a]" />
              确认前不会写入工作台
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="h-9 rounded-md border border-[#e3e5e9] px-4 text-13 font-medium text-[#606979] hover:bg-[#f5f6f7] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={saving || !targetTable || !valueText(values[targetTable.primary_field_id]).trim()}
                className="flex h-9 items-center rounded-md bg-[#ffc928] px-4 text-13 font-medium text-[#252f49] hover:bg-[#f5bd12] disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {saving ? "添加中" : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      </ModalCore>
    </>
  );
}
