import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  TPersonalWorkbenchField,
  TPersonalWorkbenchItem,
  TPersonalWorkbenchTable,
} from "@/types/personal-workbench";

type TTimelineScale = "week" | "month" | "quarter";

type TIterationTimelineProps = {
  table: TPersonalWorkbenchTable;
  items: TPersonalWorkbenchItem[];
};

type TTimelineRange = {
  start: Date;
  end: Date;
  minWidth: number;
};

const ROW_HEIGHT = 52;

const textValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join("、");
  return String(value);
};

const findField = (fields: TPersonalWorkbenchField[], names: string[]) =>
  fields.find((field) => names.includes(field.name.trim()));

const dateValue = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const rangeForScale = (scale: TTimelineScale, anchor: Date): TTimelineRange => {
  if (scale === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return { start, end: addDays(start, 13), minWidth: 980 };
  }
  if (scale === "quarter") {
    return { start: startOfQuarter(anchor), end: endOfQuarter(anchor), minWidth: 1260 };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor), minWidth: 1360 };
};

const statusColors = (status: string) => {
  if (status.includes("完成")) return "border-[#9ccf7c] bg-[#dff0b1] text-[#315b24]";
  if (status.includes("进行")) return "border-[#e4b21b] bg-[#ffe47d] text-[#5f4800]";
  if (status.includes("取消")) return "border-[#c9cdd3] bg-[#e6e8eb] text-[#697283]";
  return "border-[#e7c65b] bg-[#fff0b8] text-[#5f4800]";
};

export function IterationTimeline({ table, items }: TIterationTimelineProps) {
  const [scale, setScale] = useState<TTimelineScale>("month");
  const [anchor, setAnchor] = useState(new Date());
  const range = useMemo(() => rangeForScale(scale, anchor), [anchor, scale]);
  const days = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range]);
  const totalDays = days.length;

  const titleField = table.fields.find((field) => field.id === table.primary_field_id) || table.fields[0];
  const startField = findField(table.fields, ["开始日期", "开始时间"]);
  const endField = findField(table.fields, ["截止日期", "结束时间"]);
  const ownerField = findField(table.fields, ["任务执行人", "负责人"]);
  const statusField = findField(table.fields, ["进度状态", "状态"]);

  const moveRange = (direction: -1 | 1) => {
    if (scale === "week") setAnchor((current) => addDays(current, direction * 14));
    else setAnchor((current) => addMonths(current, direction * (scale === "quarter" ? 3 : 1)));
  };

  const rangeLabel =
    scale === "quarter"
      ? `${format(range.start, "yyyy 年 M 月", { locale: zhCN })} - ${format(range.end, "M 月", { locale: zhCN })}`
      : scale === "week"
        ? `${format(range.start, "M 月 d 日", { locale: zhCN })} - ${format(range.end, "M 月 d 日", { locale: zhCN })}`
        : format(range.start, "yyyy 年 M 月", { locale: zhCN });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#e9eaed] px-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#d9a20b]" />
          <span className="text-sm font-semibold text-[#252f49]">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center rounded-md border border-[#e1e4e8] bg-[#f7f8fa] p-0.5">
            {(["week", "month", "quarter"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScale(value)}
                className={`text-xs h-7 min-w-10 rounded px-2 font-medium ${
                  scale === value ? "shadow-sm bg-white text-[#252f49]" : "text-[#7b8493] hover:text-[#252f49]"
                }`}
              >
                {{ week: "周", month: "月", quarter: "季" }[value]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="text-xs h-8 rounded-md border border-[#efd068] bg-[#fff9df] px-3 font-medium text-[#7d5e00] hover:bg-[#fff3b8]"
          >
            今天
          </button>
          <button
            type="button"
            title="上一段时间"
            aria-label="上一段时间"
            onClick={() => moveRange(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#657080] hover:bg-[#f3f4f6]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="下一段时间"
            aria-label="下一段时间"
            onClick={() => moveRange(1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#657080] hover:bg-[#f3f4f6]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-h-full w-max min-w-full">
          <div className="sticky left-0 z-20 w-[360px] shrink-0 border-r border-[#dfe2e7] bg-white shadow-[4px_0_10px_rgba(37,47,73,0.04)]">
            <div className="text-xs grid h-12 grid-cols-[minmax(0,1fr)_100px] items-center border-b border-[#e9eaed] bg-[#fafbfc] px-4 font-semibold text-[#697283]">
              <span>子任务</span>
              <span>执行人 / 状态</span>
            </div>
            {items.map((item) => {
              const title = textValue(item.values[titleField?.id]) || "未命名事项";
              const owner = ownerField ? textValue(item.values[ownerField.id]) : "";
              const status = statusField ? textValue(item.values[statusField.id]) : "";
              return (
                <div
                  key={item.id}
                  style={{ height: ROW_HEIGHT }}
                  className="text-sm grid grid-cols-[minmax(0,1fr)_100px] items-center border-b border-[#eceef1] px-4 hover:bg-[#fffdf5]"
                >
                  <span className="truncate pr-3 font-medium text-[#30394c]" title={title}>
                    {title}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs truncate text-[#5f6878]">{owner || "未安排"}</div>
                    <div className="mt-0.5 truncate text-[11px] text-[#9aa1ad]">{status || "未设置状态"}</div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-sm flex h-36 items-center justify-center text-[#9299a6]">这里还没有迭代任务</div>
            )}
          </div>

          <div style={{ minWidth: range.minWidth }} className="relative flex-1">
            <div
              className="sticky top-0 z-10 grid h-12 border-b border-[#e9eaed] bg-[#fafbfc]"
              style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
            >
              {days.map((day, index) => {
                const showLabel = scale !== "quarter" || index === 0 || format(day, "d") === "1";
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex items-center justify-center border-r border-[#eceef1] text-[11px] text-[#7d8593] ${
                      isSameDay(day, new Date()) ? "bg-[#fff7cf] font-semibold text-[#8a6700]" : ""
                    }`}
                  >
                    {showLabel ? (scale === "quarter" ? format(day, "M 月") : format(day, "d")) : ""}
                  </div>
                );
              })}
            </div>

            <div className="relative" style={{ minHeight: Math.max(items.length * ROW_HEIGHT, 144) }}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
              >
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-[#eef0f2] ${isSameDay(day, new Date()) ? "bg-[#fffaf0]" : ""}`}
                  />
                ))}
              </div>

              {items.map((item, rowIndex) => {
                const rawStart = startField ? dateValue(item.values[startField.id]) : null;
                const rawEnd = endField ? dateValue(item.values[endField.id]) : null;
                let taskStart = rawStart || rawEnd;
                let taskEnd = rawEnd || rawStart;
                if (taskStart && taskEnd && isAfter(taskStart, taskEnd)) [taskStart, taskEnd] = [taskEnd, taskStart];
                const title = textValue(item.values[titleField?.id]) || "未命名事项";
                const status = statusField ? textValue(item.values[statusField.id]) : "";
                const visible =
                  taskStart && taskEnd && !isAfter(taskStart, range.end) && !isBefore(taskEnd, range.start);
                const clippedStart = taskStart && isBefore(taskStart, range.start) ? range.start : taskStart;
                const clippedEnd = taskEnd && isAfter(taskEnd, range.end) ? range.end : taskEnd;
                const left = clippedStart ? (differenceInCalendarDays(clippedStart, range.start) / totalDays) * 100 : 0;
                const width =
                  clippedStart && clippedEnd
                    ? ((differenceInCalendarDays(clippedEnd, clippedStart) + 1) / totalDays) * 100
                    : 0;
                return (
                  <div
                    key={item.id}
                    style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                    className="absolute right-0 left-0 border-b border-[#eceef1]"
                  >
                    {visible && (
                      <div
                        title={`${title}：${format(taskStart!, "M月d日")} - ${format(taskEnd!, "M月d日")}`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%` }}
                        className={`text-xs absolute top-2.5 flex h-8 items-center overflow-hidden rounded border px-2 font-medium shadow-[0_1px_2px_rgba(37,47,73,0.08)] ${statusColors(status)}`}
                      >
                        <span className="truncate">{title}</span>
                      </div>
                    )}
                    {!taskStart && !taskEnd && (
                      <div className="text-xs absolute top-4 left-4 text-[#b0b5be]">填写开始日期和截止日期后显示</div>
                    )}
                  </div>
                );
              })}

              {differenceInCalendarDays(new Date(), range.start) >= 0 &&
                differenceInCalendarDays(range.end, new Date()) >= 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 z-[2] w-px bg-[#e0a900]"
                    style={{
                      left: `${((differenceInCalendarDays(new Date(), range.start) + 0.5) / totalDays) * 100}%`,
                    }}
                  >
                    <span className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-[#e0a900]" />
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
