'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { DailyProblem } from './ProblemCard';

interface RatingModalProps {
  isOpen: boolean;
  problem: DailyProblem | null;
  onRate: (problemId: number, mastery: number) => void;
  onClose: () => void;
}

const ratingOptions = [
  {
    value: 3,
    label: '熟练',
    emoji: '🟢',
    description: '不看提示独立完成',
    className: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 2,
    label: '需提示',
    emoji: '🟡',
    description: '需要提示或参考思路',
    className: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 hover:border-amber-300 hover:shadow-amber-100',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  {
    value: 1,
    label: '忘了',
    emoji: '🔴',
    description: '完全没思路，需要复习',
    className: 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200 hover:border-red-300 hover:shadow-red-100',
    iconBg: 'bg-red-100 text-red-700',
  },
];

export function RatingModal({ isOpen, problem, onRate, onClose }: RatingModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !problem) return null;

  const displayTitle = problem.titleCn || problem.title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-sm animate-in rounded-2xl border bg-card p-6 shadow-xl',
          'motion-safe:animate-[scale-in_0.2s_ease-out]',
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">请评价你的掌握程度</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{displayTitle}</h3>
        </div>

        {/* Rating buttons */}
        <div className="space-y-3">
          {ratingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onRate(problem.id, option.value)}
              className={cn(
                'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]',
                option.className,
              )}
            >
              {/* Emoji circle */}
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl',
                  option.iconBg,
                )}
              >
                {option.emoji}
              </span>

              {/* Label + description */}
              <div className="flex-1">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs opacity-70">{option.description}</span>
              </div>

              {/* Score badge */}
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">
                {option.value}分
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
