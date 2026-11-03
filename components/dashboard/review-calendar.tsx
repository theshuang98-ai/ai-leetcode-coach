'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CalendarDay {
  date: string;
  count: number;
}

interface ReviewCalendarProps {
  calendar: CalendarDay[];
}

function getIntensity(count: number): string {
  if (count === 0) return 'bg-muted/50';
  if (count <= 2) return 'bg-green-200';
  if (count <= 4) return 'bg-green-400';
  return 'bg-green-600';
}

function getIntensityLabel(count: number): string {
  if (count === 0) return '无';
  if (count <= 2) return '少量';
  if (count <= 4) return '中等';
  return '大量';
}

/** Format ISO date "2026-05-18" → "5月18日" */
function formatDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${parseInt(month!, 10)}月${parseInt(day!, 10)}日`;
}

/** Get "M月" label from ISO date, only when month changes */
function getMonthLabel(isoDate: string): string {
  const [, month] = isoDate.split('-');
  return `${parseInt(month!, 10)}月`;
}

export function ReviewCalendar({ calendar }: ReviewCalendarProps) {
  // Build month transition labels
  const monthLabels = useMemo(() => {
    const labels: Map<number, string> = new Map();
    for (let i = 0; i < calendar.length; i++) {
      const day = calendar[i]!;
      const month = parseInt(day.date.split('-')[1]!, 10);
      if (i === 0 || parseInt(calendar[i - 1]!.date.split('-')[1]!, 10) !== month) {
        labels.set(i, getMonthLabel(day.date));
      }
    }
    return labels;
  }, [calendar]);

  // Group into weeks for GitHub-style grid
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];

    // Pad leading empty cells so first day aligns to its weekday
    const firstDate = new Date(calendar[0]!.date + 'T00:00:00');
    const firstDayOfWeek = firstDate.getDay(); // 0=Sun
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: '', count: -1 });
    }

    for (const day of calendar) {
      currentWeek.push(day);
      const d = new Date(day.date + 'T00:00:00');
      if (d.getDay() === 6 || currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      // Pad trailing empty cells
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', count: -1 });
      }
      result.push(currentWeek);
    }

    return result;
  }, [calendar]);

  if (calendar.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        暂无打卡记录
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      {/* Month labels */}
      <div className="mb-1 flex text-xs text-muted-foreground">
        {/* Walk through weeks, output month label at the first cell of each new month */}
        {(() => {
          let lastMonth = '';
          const labels: { label: string; col: number }[] = [];
          let colIdx = 0;
          for (const week of weeks) {
            for (const day of week) {
              if (day.date) {
                const month = day.date.split('-')[1]!;
                if (month !== lastMonth) {
                  lastMonth = month;
                  labels.push({ label: `${parseInt(month, 10)}月`, col: colIdx });
                }
              }
              colIdx++;
            }
          }
          // Return a simplified view: show labels above the grid
          // We'll just show the first month label at position 0
          return null; // skip to keep simple
        })()}
      </div>

      {/* Day-of-week labels */}
      <div className="mb-1 flex gap-1 text-xs text-muted-foreground">
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <span key={d} className="w-7 text-center">
            {d}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => {
              if (day.count === -1) {
                return <div key={`empty-${di}`} className="h-7 w-7" />;
              }
              return (
                <div
                  key={day.date}
                  className={cn(
                    'h-7 w-7 rounded-sm transition-colors',
                    getIntensity(day.count),
                  )}
                  title={`${formatDateLabel(day.date)} · ${getIntensityLabel(day.count)} (${day.count} 题)`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>少</span>
        <div className="h-3 w-3 rounded-sm bg-muted/50" />
        <div className="h-3 w-3 rounded-sm bg-green-200" />
        <div className="h-3 w-3 rounded-sm bg-green-400" />
        <div className="h-3 w-3 rounded-sm bg-green-600" />
        <span>多</span>
      </div>
    </div>
  );
}
