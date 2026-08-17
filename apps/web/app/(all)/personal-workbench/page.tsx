import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  Bug,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  FileSearch,
  GripVertical,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  Settings2,
  Search,
  Sparkles,
  Table2,
  Target,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { CaseClusterRoot, CreateCaseClusterAnalysisModal } from "@/components/case-cluster";
import { ScheduleCalendar } from "@/components/personal-workbench/calendar";
import { OptionEditorModal } from "@/components/personal-workbench/option-editor-modal";
import {
  type TPersonalWorkbenchViewSettings,
  ViewEditorModal,
} from "@/components/personal-workbench/view-editor-modal";
import { PersonalWorkbenchService } from "@/services/personal-workbench.service";
import type {
  TPersonalWorkbenchField,
  TPersonalWorkbenchItem,
  TPersonalWorkbenchOption,
  TPersonalWorkbenchTable,
  TPersonalWorkbenchView,
} from "@/types/personal-workbench";

const workbenchService = new PersonalWorkbenchService();

const EMPTY_VIEW_SETTINGS: TPersonalWorkbenchViewSettings = {
  hiddenViewIds: [],
  renamedViewNames: {},
  customViews: [],
};

const SECTION_ICONS = {
  "product-goals": Target,
  "personal-tasks": CheckSquare2,
  scenarios: FileSearch,
  requirements: ClipboardList,
  functions: ListChecks,
  iterations: Layers3,
  bugs: Bug,
  badcases: CircleDot,
  "case-clusters": Sparkles,
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("、");
  if (typeof value === "object") {
    const link = value as { text?: string; url?: string };
    return link.text || link.url || JSON.stringify(value);
  }
  return String(value);
};

type TEditableCellProps = {
  field: TPersonalWorkbenchField;
  value: unknown;
  onSave: (value: unknown) => Promise<void>;
};

type TWorkbenchRowDropEdge = "top" | "bottom";

type TDraggableWorkbenchRowProps = {
  children: ReactNode;
  enabled: boolean;
  itemId: string;
  rowNumber: number;
  onMove: (sourceItemId: string, targetItemId: string, edge: TWorkbenchRowDropEdge) => void;
};

function DraggableWorkbenchRow({ children, enabled, itemId, rowNumber, onMove }: TDraggableWorkbenchRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dropEdge, setDropEdge] = useState<TWorkbenchRowDropEdge | null>(null);

  useEffect(() => {
    const rowElement = rowRef.current;
    const dragHandleElement = dragHandleRef.current;
    if (!enabled || !rowElement || !dragHandleElement) return;
    const rowData = { type: "personal-workbench-row", itemId };

    return combine(
      draggable({
        element: rowElement,
        dragHandle: dragHandleElement,
        getInitialData: () => rowData,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: rowElement,
        canDrop: ({ source }) => source.data.type === rowData.type && source.data.itemId !== itemId,
        getData: ({ input, element }) =>
          attachClosestEdge(rowData, {
            input,
            element,
            allowedEdges: ["top", "bottom"],
          }),
        onDragEnter: ({ self }) => setDropEdge(extractClosestEdge(self.data) as TWorkbenchRowDropEdge | null),
        onDrag: ({ self }) => setDropEdge(extractClosestEdge(self.data) as TWorkbenchRowDropEdge | null),
        onDragLeave: () => setDropEdge(null),
        onDrop: ({ self, source }) => {
          const edge = extractClosestEdge(self.data) as TWorkbenchRowDropEdge | null;
          setDropEdge(null);
          if (edge && typeof source.data.itemId === "string") onMove(source.data.itemId, itemId, edge);
        },
      })
    );
  }, [enabled, itemId, onMove]);

  return (
    <tr
      ref={rowRef}
      className={`group ${dragging ? "opacity-45" : ""} ${
        dropEdge === "top"
          ? "[&>td]:shadow-[inset_0_2px_0_#ffc928]"
          : dropEdge === "bottom"
            ? "[&>td]:shadow-[inset_0_-2px_0_#ffc928]"
            : ""
      }`}
    >
      <td className="text-xs sticky left-0 z-10 h-10 border-r border-b border-[#eceef1] bg-white text-center text-[#a0a7b2] group-hover:bg-[#fffdf5]">
        {enabled ? (
          <button
            ref={dragHandleRef}
            type="button"
            aria-label={`拖动第 ${rowNumber} 项调整顺序`}
            title="按住拖动调整顺序"
            className="flex h-10 w-full cursor-grab items-center justify-center gap-0.5 text-[#9199a7] hover:text-[#9b7400] active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
            <span>{rowNumber}</span>
          </button>
        ) : (
          rowNumber
        )}
      </td>
      {children}
    </tr>
  );
}

function EditableCell({ field, value, onSave }: TEditableCellProps) {
  const [draft, setDraft] = useState(asText(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(asText(value)), [value]);

  const commit = async (nextValue: unknown = draft) => {
    if (asText(nextValue) === asText(value)) return;
    setSaving(true);
    try {
      await onSave(nextValue);
    } finally {
      setSaving(false);
    }
  };

  if (field.readonly) return <div className="min-h-10 truncate px-3 py-2.5 text-[#4f596b]">{asText(value) || "-"}</div>;

  if (field.type === 3 || (field.options.length > 0 && !field.multiple && field.type !== 4))
    return (
      <div className="relative min-h-10">
        <select
          className="text-sm h-10 w-full min-w-0 appearance-none bg-transparent px-3 pr-8 text-[#2b3448] outline-none hover:bg-[#fffdf3] focus:bg-[#fff9df]"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            void commit(event.target.value);
          }}
        >
          <option value="">未选择</option>
          {draft && !field.options.some((option) => option.name === draft) && (
            <option value={draft}>{draft}（原值）</option>
          )}
          {field.options.map((option) => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-3 right-2 h-4 w-4 text-[#8c94a3]" />
      </div>
    );

  if (field.name.trim() === "是否完成") {
    const completed =
      value === true || value === 1 || ["true", "1", "已完成", "是"].includes(String(value ?? "").toLowerCase());
    return (
      <div className="flex h-10 items-center justify-center px-3">
        <button
          type="button"
          role="switch"
          aria-label="是否完成"
          aria-checked={completed}
          title={completed ? "已完成，点击切换为未完成" : "未完成，点击切换为已完成"}
          onClick={() => void commit(!completed)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#f0bc16] focus-visible:ring-offset-2 focus-visible:outline-none ${
            completed ? "border-[#ffc928] bg-[#ffc928]" : "border-[#c9cdd3] bg-[#eceef1] hover:border-[#b9bec6]"
          }`}
        >
          <span
            className={`pointer-events-none absolute top-px left-px h-5 w-5 rounded-full shadow-[0_1px_4px_rgba(37,47,73,0.28)] transition-all duration-200 ${
              completed ? "translate-x-5 bg-white" : "translate-x-0 bg-[#aeb4bd]"
            }`}
          />
        </button>
      </div>
    );
  }

  if (field.type === 7 || field.ui_type.toLowerCase().includes("checkbox"))
    return (
      <div className="flex h-10 items-center px-3">
        <input
          aria-label={field.name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => void commit(event.target.checked)}
          className="h-4 w-4 accent-[#e6ad00]"
        />
      </div>
    );

  const isDate = field.type === 5 || field.ui_type.toLowerCase().includes("date");
  const isNumber = field.type === 2 || field.ui_type.toLowerCase().includes("number");
  return (
    <div className="relative min-h-10">
      <input
        type={isDate ? "date" : isNumber ? "number" : "text"}
        className="text-sm h-10 w-full min-w-0 bg-transparent px-3 text-[#2b3448] outline-none placeholder:text-[#b4bac4] hover:bg-[#fffdf3] focus:bg-[#fff9df]"
        value={draft}
        placeholder={field.is_primary ? "输入事项名称" : ""}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(isNumber && draft ? Number(draft) : draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {saving && <Loader2 className="absolute top-3 right-2 h-4 w-4 animate-spin text-[#d9a20b]" />}
    </div>
  );
}

const clampColumnWidth = (width: number) => Math.min(Math.max(Math.round(width), 72), 640);

const columnWidth = (
  view: TPersonalWorkbenchView | undefined,
  field: TPersonalWorkbenchField,
  customWidth?: number
) => {
  if (customWidth !== undefined) return clampColumnWidth(customWidth);
  if (field.name.trim() === "是否完成") return 88;
  const width = view?.col_infos?.[field.id]?.width;
  return Math.min(Math.max(width || (field.is_primary ? 280 : 160), 120), 420);
};

export default function PersonalWorkbenchPage() {
  const navigate = useNavigate();
  const { section } = useParams();
  const [tables, setTables] = useState<TPersonalWorkbenchTable[]>([]);
  const [items, setItems] = useState<TPersonalWorkbenchItem[]>([]);
  const [workspace, setWorkspace] = useState({ slug: "", projectId: "" });
  const [viewId, setViewId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showClusterAnalysis, setShowClusterAnalysis] = useState(false);
  const [clusterModalOpen, setClusterModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<TPersonalWorkbenchField | null>(null);
  const [optionsSaving, setOptionsSaving] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [viewEditorOpen, setViewEditorOpen] = useState(false);
  const [viewSettingsTableId, setViewSettingsTableId] = useState("");
  const [viewSettings, setViewSettings] = useState<TPersonalWorkbenchViewSettings>(EMPTY_VIEW_SETTINGS);
  const [reordering, setReordering] = useState(false);

  const isCalendar = !section || section === "calendar";
  const activeTable = isCalendar ? undefined : tables.find((table) => table.key === section) || tables[0];
  const activeViewSettings = activeTable?.id === viewSettingsTableId ? viewSettings : EMPTY_VIEW_SETTINGS;
  const availableViews = useMemo(() => {
    if (!activeTable) return [];
    const hiddenViewIds = new Set(activeViewSettings.hiddenViewIds);
    const originalViews = activeTable.views
      .filter((view) => !hiddenViewIds.has(view.id))
      .map((view) => ({
        id: view.id,
        name: activeViewSettings.renamedViewNames[view.id] || view.name,
        type: view.type,
        fields: view.fields,
        source_record_ids: view.source_record_ids,
        col_infos: view.col_infos,
        frozen_col_count: view.frozen_col_count,
      }));
    return [...originalViews, ...activeViewSettings.customViews];
  }, [activeTable, activeViewSettings]);
  const activeView = availableViews.find((view) => view.id === viewId) || availableViews[0];
  const columnStorageKey = activeTable
    ? `personal-workbench-column-widths:${activeTable.id}:${activeView?.id || "default"}`
    : "";
  const visibleFields = useMemo(() => {
    if (!activeTable) return [];
    const fieldMap = new Map(activeTable.fields.map((field) => [field.id, field]));
    const ordered = (activeView?.fields || [])
      .map((id) => fieldMap.get(id))
      .filter(Boolean) as TPersonalWorkbenchField[];
    return ordered.length > 0 ? ordered : activeTable.fields;
  }, [activeTable, activeView]);

  const visibleItems = useMemo(() => {
    const viewRecords = new Set(activeView?.source_record_ids || []);
    return items.filter((item) => {
      const belongsToView = viewRecords.size === 0 || !item.source_record_id || viewRecords.has(item.source_record_id);
      const matchesSearch =
        !search ||
        Object.values(item.values).some((value) => asText(value).toLowerCase().includes(search.toLowerCase()));
      return belongsToView && matchesSearch;
    });
  }, [activeView, items, search]);

  useEffect(() => {
    if (!activeTable) {
      setViewSettingsTableId("");
      setViewSettings(EMPTY_VIEW_SETTINGS);
      return;
    }
    const storageKey = `personal-workbench-view-settings:${activeTable.id}`;
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(storageKey) || "{}"
      ) as Partial<TPersonalWorkbenchViewSettings>;
      setViewSettings({
        hiddenViewIds: Array.isArray(stored.hiddenViewIds)
          ? stored.hiddenViewIds.filter((storedViewId): storedViewId is string => typeof storedViewId === "string")
          : [],
        renamedViewNames:
          stored.renamedViewNames && typeof stored.renamedViewNames === "object"
            ? (stored.renamedViewNames as Record<string, string>)
            : {},
        customViews: Array.isArray(stored.customViews)
          ? stored.customViews.filter(
              (view): view is TPersonalWorkbenchView =>
                Boolean(view) &&
                typeof view.id === "string" &&
                typeof view.name === "string" &&
                Array.isArray(view.fields)
            )
          : [],
      });
    } catch {
      setViewSettings(EMPTY_VIEW_SETTINGS);
    }
    setViewSettingsTableId(activeTable.id);
  }, [activeTable]);

  useEffect(() => {
    if (!activeTable || availableViews.some((view) => view.id === viewId)) return;
    setViewId(availableViews[0]?.id || "");
  }, [activeTable, availableViews, viewId]);

  useEffect(() => {
    if (!columnStorageKey) {
      setColumnWidths({});
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(columnStorageKey) || "{}") as Record<string, unknown>;
      setColumnWidths(
        Object.fromEntries(
          Object.entries(stored)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
            .map(([fieldId, width]) => [fieldId, clampColumnWidth(width)])
        )
      );
    } catch {
      setColumnWidths({});
    }
  }, [columnStorageKey]);

  useEffect(() => {
    workbenchService
      .getConfig()
      .then((config) => {
        setTables(config.tables);
        setWorkspace({ slug: config.workspace_slug, projectId: config.project_id });
        if (!section) navigate("/workbench/calendar", { replace: true });
        return config;
      })
      .catch(() => setToast({ type: TOAST_TYPE.ERROR, title: "工作台加载失败", message: "请稍后刷新页面" }))
      .finally(() => setLoading(false));
  }, [navigate, section]);

  useEffect(() => {
    if (!activeTable) {
      setItems([]);
      return;
    }
    if (activeTable.key !== "case-clusters") setShowClusterAnalysis(false);
    setItemsLoading(true);
    setViewId(activeTable.views[0]?.id || "");
    setSearch("");
    workbenchService
      .getItems(activeTable.key)
      .then(setItems)
      .catch(() => setToast({ type: TOAST_TYPE.ERROR, title: "内容加载失败", message: "请稍后再试" }))
      .finally(() => setItemsLoading(false));
  }, [activeTable]);

  const saveColumnWidths = (widths: Record<string, number>) => {
    if (!columnStorageKey) return;
    try {
      window.localStorage.setItem(columnStorageKey, JSON.stringify(widths));
    } catch {
      // The current drag still works when browser storage is unavailable.
    }
  };

  const resetColumnWidth = (fieldId: string) => {
    setColumnWidths((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([currentFieldId]) => currentFieldId !== fieldId));
      saveColumnWidths(next);
      return next;
    });
  };

  const startColumnResize = (event: ReactPointerEvent<HTMLButtonElement>, field: TPersonalWorkbenchField) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;
    const startX = event.clientX;
    const startWidth = columnWidth(activeView, field, columnWidths[field.id]);
    let latestWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestWidth = clampColumnWidth(startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) =>
        current[field.id] === latestWidth ? current : { ...current, [field.id]: latestWidth }
      );
    };

    const finishResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setColumnWidths((current) => {
        const next = { ...current, [field.id]: latestWidth };
        saveColumnWidths(next);
        return next;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  };

  const updateItem = async (itemId: string, fieldId: string, value: unknown) => {
    try {
      const updated = await workbenchService.updateItem(itemId, { [fieldId]: value });
      setItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "保存失败", message: "这次修改没有保存，请重试" });
      throw new Error("Save failed");
    }
  };

  const addItem = async () => {
    if (!activeTable) return;
    try {
      const created = await workbenchService.createItem(activeTable.key, { [activeTable.primary_field_id]: "" });
      setItems((current) => [...current, created]);
      setTables((current) =>
        current.map((table) => (table.id === activeTable.id ? { ...table, item_count: table.item_count + 1 } : table))
      );
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "新增失败", message: "请稍后再试" });
    }
  };

  const deleteItem = async (item: TPersonalWorkbenchItem) => {
    if (!activeTable || !window.confirm("确定删除这条事项吗？")) return;
    try {
      await workbenchService.deleteItem(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setTables((current) =>
        current.map((table) =>
          table.id === activeTable.id ? { ...table, item_count: Math.max(0, table.item_count - 1) } : table
        )
      );
      setToast({ type: TOAST_TYPE.SUCCESS, title: "已删除", message: "这条事项已从工作台移除" });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "删除失败", message: "请稍后再试" });
    }
  };

  const saveFieldOptions = async (options: TPersonalWorkbenchOption[]) => {
    if (!activeTable || !editingField) return;
    setOptionsSaving(true);
    try {
      const updatedTable = await workbenchService.updateFieldOptions(activeTable.id, editingField.id, options);
      setTables((current) => current.map((table) => (table.id === updatedTable.id ? updatedTable : table)));
      setEditingField(null);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "选项已保存", message: `“${editingField.name}”已更新` });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "保存失败",
        message: (error as { error?: string })?.error || "请检查选项名称后重试",
      });
    } finally {
      setOptionsSaving(false);
    }
  };

  const saveViewSettings = (settings: TPersonalWorkbenchViewSettings) => {
    if (!activeTable) return;
    setViewSettingsTableId(activeTable.id);
    setViewSettings(settings);
    try {
      window.localStorage.setItem(`personal-workbench-view-settings:${activeTable.id}`, JSON.stringify(settings));
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "未能记住视图设置", message: "本次调整仍然可以继续使用" });
    }

    const hiddenViewIds = new Set(settings.hiddenViewIds);
    const nextViewIds = [
      ...activeTable.views.filter((view) => !hiddenViewIds.has(view.id)).map((view) => view.id),
      ...settings.customViews.map((view) => view.id),
    ];
    if (!nextViewIds.includes(viewId)) setViewId(nextViewIds[0] || "");
    setViewEditorOpen(false);
    setToast({ type: TOAST_TYPE.SUCCESS, title: "视图已保存", message: "原始事项没有被删除或修改" });
  };

  const reorderRequirements = useCallback(
    async (sourceItemId: string, targetItemId: string, edge: TWorkbenchRowDropEdge) => {
      if (!activeTable || activeTable.key !== "requirements" || reordering || sourceItemId === targetItemId) return;
      const previousItems = items;
      const sourceIndex = previousItems.findIndex((item) => item.id === sourceItemId);
      if (sourceIndex < 0) return;

      const nextItems = [...previousItems];
      const [movedItem] = nextItems.splice(sourceIndex, 1);
      const targetIndex = nextItems.findIndex((item) => item.id === targetItemId);
      if (targetIndex < 0) return;
      nextItems.splice(edge === "bottom" ? targetIndex + 1 : targetIndex, 0, movedItem);

      setItems(nextItems);
      setReordering(true);
      try {
        const savedItems = await workbenchService.reorderItems(
          activeTable.key,
          nextItems.map((item) => item.id)
        );
        setItems(savedItems);
      } catch {
        setItems(previousItems);
        setToast({ type: TOAST_TYPE.ERROR, title: "排序保存失败", message: "已恢复原来的顺序，请重新拖动" });
      } finally {
        setReordering(false);
      }
    },
    [activeTable, items, reordering]
  );

  const requirementsOrderEnabled =
    activeTable?.key === "requirements" &&
    activeView?.id === activeTable.views[0]?.id &&
    !search &&
    visibleItems.length > 1 &&
    !reordering;

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f7f9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#d9a20b]" />
      </div>
    );

  return (
    <div className="font-sans flex h-screen min-w-[1024px] overflow-hidden bg-[#f6f7f9] text-[#252d3d]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[#e8e9ec] bg-white">
        <div className="flex h-[72px] items-center border-b border-[#eeeef0] px-5">
          <div className="text-sm shadow-sm relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#252f49] font-semibold text-white">
            产
            <span className="absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full bg-[#ffc928]" />
          </div>
          <div className="ml-3">
            <div className="text-[15px] font-semibold text-[#252f49]">个人产品工作台</div>
            <div className="text-xs mt-0.5 text-[#9299a6]">需求管理</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <button
            type="button"
            onClick={() => navigate("/workbench/calendar")}
            className={`text-sm mb-1.5 flex h-10 w-full items-center rounded-md px-3 text-left transition-colors ${
              isCalendar
                ? "bg-[#fff6cc] font-medium text-[#252f49] shadow-[inset_3px_0_0_#ffc928]"
                : "text-[#606979] hover:bg-[#f6f7f9] hover:text-[#252f49]"
            }`}
          >
            <CalendarDays className={`mr-3 h-4 w-4 shrink-0 ${isCalendar ? "text-[#d9a20b]" : ""}`} />
            <span className="min-w-0 flex-1 truncate">排期日历</span>
          </button>
          {tables.map((table) => {
            const Icon = SECTION_ICONS[table.key as keyof typeof SECTION_ICONS] || ClipboardList;
            const active = table.key === activeTable?.key;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => navigate(`/workbench/${table.key}`)}
                className={`text-sm mb-1.5 flex h-10 w-full items-center rounded-md px-3 text-left transition-colors ${
                  active
                    ? "bg-[#fff6cc] font-medium text-[#252f49] shadow-[inset_3px_0_0_#ffc928]"
                    : "text-[#606979] hover:bg-[#f6f7f9] hover:text-[#252f49]"
                }`}
              >
                <Icon className={`mr-3 h-4 w-4 shrink-0 ${active ? "text-[#d9a20b]" : ""}`} />
                <span className="min-w-0 flex-1 truncate">{table.name}</span>
                <span
                  className={`ml-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                    active ? "bg-white/80 text-[#9b7400]" : "bg-[#f2f3f5] text-[#9299a6]"
                  }`}
                >
                  {table.item_count}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="text-xs flex items-center border-t border-[#eeeef0] px-5 py-4 text-[#9299a6]">
          <span className="mr-2 h-2 w-2 rounded-full bg-[#ffc928]" />
          数据仅保存在你的工作台
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e8e9ec] bg-white px-7">
          <div>
            <h1 className="text-xl font-semibold text-[#252f49]">
              {isCalendar ? "排期日历" : activeTable?.name || "个人产品工作台"}
            </h1>
            <p className="text-xs mt-1 text-[#9299a6]">
              {isCalendar
                ? "集中查看目标、需求和任务的时间安排"
                : activeTable?.key === "product-goals"
                  ? "定季度、月度或阶段目标，不管具体怎么做"
                  : activeTable?.key === "personal-tasks"
                    ? "日常工作安排"
                    : activeTable?.key === "scenarios"
                      ? "访谈、反馈、观察之后，收集用户真实遇到的问题"
                      : activeTable?.key === "requirements"
                        ? "所有可能要做的产品需求"
                        : activeTable?.key === "functions"
                          ? "梳理产品结构，产品现在有哪些功能"
                          : activeTable?.key === "iterations"
                            ? "需求确定进入某个版本后，把需求拆成研发能执行的小任务"
                            : activeTable?.key === "bugs"
                              ? "测试或上线后发现故障，记录本应正常、实际上坏掉的问题"
                              : activeTable?.key === "badcases"
                                ? "评测或用户反馈时，AI有回答，但回答质量不行"
                                : activeTable?.key === "case-clusters"
                                  ? "Badcase积累到一定数量后，把一堆坏案例归类，寻找共同根因"
                                  : `共 ${visibleItems.length} 条事项`}
            </p>
          </div>
          {!isCalendar && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-[#a4aab5]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索当前表格"
                  className="text-sm h-9 w-56 rounded-md border border-[#e3e5e9] bg-[#f8f9fa] pr-3 pl-9 text-[#2b3448] outline-none placeholder:text-[#a4aab5] focus:border-[#f0bc16] focus:bg-white focus:ring-2 focus:ring-[#fff2b5]"
                />
              </div>
              {activeTable?.key === "case-clusters" && workspace.slug && (
                <button
                  type="button"
                  title={showClusterAnalysis ? "查看原始记录" : "打开 AI 聚类分析"}
                  onClick={() => {
                    if (showClusterAnalysis) setShowClusterAnalysis(false);
                    else {
                      setShowClusterAnalysis(true);
                      setClusterModalOpen(true);
                    }
                  }}
                  className="text-sm flex h-9 items-center rounded-md border border-[#e3b61c] bg-white px-3 font-medium text-[#7d5e00] hover:bg-[#fff9df]"
                >
                  {showClusterAnalysis ? <Table2 className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {showClusterAnalysis ? "原始记录" : "AI 聚类"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void addItem()}
                className="text-sm flex h-9 items-center rounded-md bg-[#ffc928] px-4 font-medium text-[#252f49] shadow-[0_2px_8px_rgba(217,162,11,0.2)] hover:bg-[#f5bd12]"
              >
                <Plus className="mr-2 h-4 w-4" />
                新增事项
              </button>
            </div>
          )}
        </header>

        {!isCalendar && !showClusterAnalysis && (
          <div className="flex h-12 shrink-0 items-end border-b border-[#e8e9ec] bg-white px-7">
            <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
              {(availableViews.length
                ? availableViews
                : [
                    {
                      id: "default",
                      name: "全部",
                      fields: [],
                      source_record_ids: [],
                      type: 1,
                      col_infos: {},
                      frozen_col_count: 1,
                    },
                  ]
              ).map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setViewId(view.id)}
                  className={`text-sm h-10 border-b-2 px-3 ${
                    (activeView?.id || "default") === view.id
                      ? "border-[#ffc928] font-medium text-[#252f49]"
                      : "border-transparent text-[#858d9b] hover:text-[#252f49]"
                  }`}
                >
                  {view.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              title="增加、改名或隐藏视图"
              onClick={() => setViewEditorOpen(true)}
              className="mb-1 ml-3 flex h-8 shrink-0 items-center rounded-md px-2.5 text-13 font-medium text-[#697283] hover:bg-[#fff6cc] hover:text-[#7d5e00]"
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              管理视图
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden bg-[#f6f7f9]">
          {isCalendar ? (
            <div className="h-full p-5">
              <div className="h-full overflow-hidden rounded-lg border border-[#e6e8ec] bg-white shadow-[0_1px_3px_rgba(37,47,73,0.06)]">
                <ScheduleCalendar onOpenTable={(tableKey) => navigate(`/workbench/${tableKey}`)} />
              </div>
            </div>
          ) : showClusterAnalysis && workspace.slug ? (
            <CaseClusterRoot
              workspaceSlug={workspace.slug}
              projectId={workspace.projectId}
              onCreate={() => setClusterModalOpen(true)}
            />
          ) : itemsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#d9a20b]" />
            </div>
          ) : (
            <div className="h-full p-5">
              <div className="h-full overflow-auto rounded-lg border border-[#e6e8ec] bg-white shadow-[0_1px_3px_rgba(37,47,73,0.06)]">
                <table className="text-sm w-max min-w-full border-separate border-spacing-0 text-left">
                  <thead className="sticky top-0 z-20 bg-[#fafbfc]">
                    <tr>
                      <th className="text-xs font-normal sticky left-0 z-30 h-11 w-12 min-w-12 border-r border-b border-[#e9eaed] bg-[#fafbfc] text-center text-[#a0a7b2]">
                        #
                      </th>
                      {visibleFields.map((field, index) => {
                        const width = columnWidth(activeView, field, columnWidths[field.id]);
                        return (
                          <th
                            key={field.id}
                            style={{ width, minWidth: width }}
                            className={`text-xs h-11 border-r border-b border-[#e9eaed] px-3 font-semibold text-[#656e7d] ${
                              index === 0 ? "sticky left-12 z-20 bg-[#fafbfc]" : "relative"
                            }`}
                          >
                            <div
                              className={`flex items-center gap-2 ${
                                field.name.trim() === "是否完成" ? "justify-center" : "justify-between"
                              }`}
                            >
                              <span className="truncate">{field.name}</span>
                              {(field.type === 3 || field.type === 4 || field.options.length > 0) && (
                                <button
                                  type="button"
                                  title={`编辑“${field.name}”选项`}
                                  aria-label={`编辑“${field.name}”选项`}
                                  onClick={() => setEditingField(field)}
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#a0a7b2] hover:bg-[#fff4c2] hover:text-[#9b7400]"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label={`调整“${field.name}”列宽`}
                              title="左右拖动调整列宽，双击恢复默认"
                              onPointerDown={(event) => startColumnResize(event, field)}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                resetColumnWidth(field.id);
                              }}
                              className="group/resize absolute top-0 -right-1 z-30 h-full w-2 cursor-col-resize touch-none"
                            >
                              <span className="absolute top-0 right-1/2 h-full w-px bg-transparent group-hover/resize:bg-[#ffc928]" />
                            </button>
                          </th>
                        );
                      })}
                      <th className="sticky right-0 z-20 h-11 w-10 min-w-10 border-b border-[#e9eaed] bg-[#fafbfc] text-center" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item, rowIndex) => (
                      <DraggableWorkbenchRow
                        key={item.id}
                        enabled={requirementsOrderEnabled}
                        itemId={item.id}
                        rowNumber={rowIndex + 1}
                        onMove={(sourceItemId, targetItemId, edge) =>
                          void reorderRequirements(sourceItemId, targetItemId, edge)
                        }
                      >
                        {visibleFields.map((field, fieldIndex) => (
                          <td
                            key={field.id}
                            className={`h-10 border-r border-b border-[#eceef1] align-top group-hover:bg-[#fffdf5] ${fieldIndex === 0 ? "sticky left-12 z-10 bg-white group-hover:bg-[#fffdf5]" : ""}`}
                          >
                            <EditableCell
                              field={field}
                              value={item.values[field.id]}
                              onSave={(value) => updateItem(item.id, field.id, value)}
                            />
                          </td>
                        ))}
                        <td className="sticky right-0 z-10 h-10 border-b border-[#eceef1] bg-white text-center group-hover:bg-[#fffdf5]">
                          <button
                            type="button"
                            title="删除事项"
                            aria-label="删除事项"
                            onClick={() => void deleteItem(item)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-[#a0a7b2] opacity-0 group-hover:opacity-100 hover:bg-[#fff0f0] hover:text-[#d9363e] focus:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </DraggableWorkbenchRow>
                    ))}
                    {visibleItems.length === 0 && (
                      <tr>
                        <td colSpan={visibleFields.length + 2} className="text-sm h-48 text-center text-[#9299a6]">
                          {search ? (
                            "没有找到匹配内容"
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <span>这里还没有事项</span>
                              <button
                                type="button"
                                onClick={() => void addItem()}
                                className="text-sm flex h-9 items-center rounded-md bg-[#ffc928] px-4 font-medium text-[#252f49] shadow-[0_2px_8px_rgba(217,162,11,0.2)] hover:bg-[#f5bd12]"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                新增第一条事项
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      {workspace.slug && (
        <CreateCaseClusterAnalysisModal
          isOpen={clusterModalOpen}
          onClose={() => setClusterModalOpen(false)}
          workspaceSlug={workspace.slug}
          projectId={workspace.projectId}
        />
      )}
      <OptionEditorModal
        isOpen={Boolean(editingField)}
        table={activeTable}
        field={editingField}
        saving={optionsSaving}
        onClose={() => setEditingField(null)}
        onSave={saveFieldOptions}
      />
      <ViewEditorModal
        isOpen={viewEditorOpen}
        table={activeTable}
        settings={activeViewSettings}
        onClose={() => setViewEditorOpen(false)}
        onSave={saveViewSettings}
      />
    </div>
  );
}
