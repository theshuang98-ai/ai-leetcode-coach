'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

// Topics from data/problems.json
const AVAILABLE_TOPICS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Stack & Queue',
  'Linked List',
  'Trees & Graphs',
  'Dynamic Programming',
  'Backtracking',
  'Greedy',
  'Intervals',
  'Math & Bit Manipulation',
] as const;

const TOPIC_LABELS: Record<string, string> = {
  'Arrays & Hashing': '数组与哈希',
  'Two Pointers': '双指针',
  'Sliding Window': '滑动窗口',
  'Binary Search': '二分查找',
  'Stack & Queue': '栈与队列',
  'Linked List': '链表',
  'Trees & Graphs': '树与图',
  'Dynamic Programming': '动态规划',
  'Backtracking': '回溯算法',
  'Greedy': '贪心算法',
  'Intervals': '区间问题',
  'Math & Bit Manipulation': '数学与位运算',
};

const SLIDER_MIN = 30;
const SLIDER_MAX = 200;
const SLIDER_STEP = 10;

interface CustomPreferencesProps {
  selectedTopics: string[];
  totalQuestions: number;
  onToggleTopic: (topic: string) => void;
  onTotalChange: (value: number) => void;
}

export function CustomPreferences({
  selectedTopics,
  totalQuestions,
  onToggleTopic,
  onTotalChange,
}: CustomPreferencesProps) {
  const allSelected = selectedTopics.length === AVAILABLE_TOPICS.length;
  const noneSelected = selectedTopics.length === 0;

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all (not allowed since we need at least one topic listed)
      return;
    }
    // Select all
    AVAILABLE_TOPICS.forEach((t) => {
      if (!selectedTopics.includes(t)) onToggleTopic(t);
    });
  };

  return (
    <div className="space-y-8">
      {/* Topic grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">选择你想练习的题型</p>
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              'text-xs font-medium transition-colors',
              allSelected
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {allSelected ? '已全选' : '全选'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                onClick={() => onToggleTopic(topic)}
                className={cn(
                  'group flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSelected
                    ? 'border-primary/60 bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/20 hover:text-foreground',
                )}
                aria-pressed={isSelected}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30 group-hover:border-muted-foreground/50',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{TOPIC_LABELS[topic] || topic}</span>
              </button>
            );
          })}
        </div>

        {noneSelected && (
          <p className="mt-2 text-xs text-destructive">请至少选择一个题型</p>
        )}
      </div>

      {/* Total questions slider */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">总题量</p>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {totalQuestions} 题
          </span>
        </div>

        <div className="relative">
          {/* Track background with gradient fill */}
          <div className="relative h-2 w-full rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-150"
              style={{
                width: `${((totalQuestions - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`,
              }}
            />
          </div>

          {/* Range input (invisible track, large thumb) */}
          <input
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={SLIDER_STEP}
            value={totalQuestions}
            onChange={(e) => onTotalChange(Number(e.target.value))}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label={`Total questions: ${totalQuestions}`}
          />

          {/* Custom thumb indicator */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{
              left: `calc(${((totalQuestions - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}% - 10px)`,
            }}
          >
            <div className="h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md ring-4 ring-primary/10" />
          </div>

          {/* Min/Max labels */}
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{SLIDER_MIN} 题</span>
            <span>{SLIDER_MAX} 题</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="mt-3 flex gap-2">
          {[50, 80, 100, 150].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onTotalChange(preset)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200',
                totalQuestions === preset
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
