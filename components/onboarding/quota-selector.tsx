'use client';

import { cn } from '@/lib/utils';

interface QuotaSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const QUOTA_OPTIONS = [
  { value: 3, label: '3 题/天', subtitle: '轻松入门' },
  { value: 5, label: '5 题/天', subtitle: '标准强度' },
  { value: 10, label: '10 题/天', subtitle: '冲刺模式' },
] as const;

export function QuotaSelector({ value, onChange }: QuotaSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">选择每日刷题量</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {QUOTA_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'group relative flex flex-col items-center rounded-xl border-2 px-4 py-5 text-center transition-all duration-300',
                'hover:scale-[1.02]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/15 shadow-lg shadow-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground/20 hover:bg-accent/20',
              )}
              aria-pressed={isSelected}
            >
              {/* Radio indicator */}
              <div
                className={cn(
                  'mb-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30 group-hover:border-muted-foreground/50',
                )}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span
                className={cn(
                  'text-lg font-bold transition-colors duration-300',
                  isSelected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </span>
              <span
                className={cn(
                  'mt-1 text-xs transition-colors duration-300',
                  isSelected ? 'text-muted-foreground' : 'text-muted-foreground/60',
                )}
              >
                {option.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
