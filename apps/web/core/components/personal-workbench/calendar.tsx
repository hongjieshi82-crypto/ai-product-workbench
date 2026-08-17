import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import { PersonalWorkbenchService } from "@/services/personal-workbench.service";
import type { TPersonalWorkbenchCalendarItem } from "@/types/personal-workbench";

const workbenchService = new PersonalWorkbenchService();

const TABLE_COLORS: Record<string, { backgroundColor: string; borderColor: string; color: string }> = {
  "product-goals": { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1e40af" },
  "personal-tasks": { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" },
  scenarios: { backgroundColor: "#fffbeb", borderColor: "#fde68a", color: "#92400e" },
  requirements: { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", color: "#5b21b6" },
  functions: { backgroundColor: "#ecfeff", borderColor: "#a5f3fc", color: "#155e75" },
  iterations: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3" },
  bugs: { backgroundColor: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" },
  badcases: { backgroundColor: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" },
  "case-clusters": { backgroundColor: "#fdf4ff", borderColor: "#f5d0fe", color: "#86198f" },
};

type TScheduleCalendarProps = {
  onOpenTable: (tableKey: string) => void;
};

export function ScheduleCalendar({ onOpenTable }: TScheduleCalendarProps) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [items, setItems] = useState<TPersonalWorkbenchCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workbenchService
      .getCalendarItems()
      .then(setItems)
      .catch(() => setToast({ type: TOAST_TYPE.ERROR, title: "日历加载失败", message: "请稍后刷新页面" }))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month]
  );

  const itemsForDay = (day: Date) =>
    items.filter((item) => {
      const start = parseISO(item.start_date);
      const end = parseISO(item.end_date);
      return isWithinInterval(day, { start: start <= end ? start : end, end: start <= end ? end : start });
    });

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#d9a20b]" />
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e9eaed] px-5">
        <div>
          <div className="text-base font-semibold text-[#252f49]">
            {format(month, "yyyy 年 M 月", { locale: zhCN })}
          </div>
          <div className="text-xs mt-0.5 text-[#9299a6]">点击日程可打开对应表格</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="text-sm h-8 rounded-md border border-[#efd068] bg-[#fff9df] px-3 font-medium text-[#7d5e00] hover:bg-[#fff3b8]"
          >
            今天
          </button>
          <button
            type="button"
            title="上个月"
            aria-label="上个月"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#657080] hover:bg-[#f3f4f6] hover:text-[#252f49]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="下个月"
            aria-label="下个月"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#657080] hover:bg-[#f3f4f6] hover:text-[#252f49]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="text-xs grid h-10 shrink-0 grid-cols-7 border-b border-[#e9eaed] bg-[#fafbfc] font-medium text-[#7d8593]">
        {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((label) => (
          <div key={label} className="flex items-center justify-center border-r border-[#eceef1] last:border-r-0">
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(96px, 1fr))` }}
      >
        {days.map((day) => {
          const dayItems = itemsForDay(day);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`min-w-0 overflow-hidden border-r border-b border-[#eceef1] p-2 transition-colors hover:bg-[#fffdf5] ${
                isSameMonth(day, month) ? "bg-white" : "bg-[#fafbfc]"
              }`}
            >
              <div
                className={`text-xs mb-1.5 flex h-6 w-6 items-center justify-center rounded-full ${
                  today
                    ? "bg-[#ffc928] font-semibold text-[#252f49] shadow-[0_1px_4px_rgba(217,162,11,0.25)]"
                    : isSameMonth(day, month)
                      ? "text-[#515b6b]"
                      : "text-[#b0b5be]"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.table_name}：${item.title}`}
                    onClick={() => onOpenTable(item.table_key)}
                    style={TABLE_COLORS[item.table_key]}
                    className="text-xs block h-6 w-full truncate rounded border px-1.5 text-left transition-opacity hover:opacity-80"
                  >
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <div className="text-xs px-1 text-[#9299a6]">还有 {dayItems.length - 3} 项</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
