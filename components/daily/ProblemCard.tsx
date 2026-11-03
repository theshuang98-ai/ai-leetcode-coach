'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DailyProblem {
  id: number;
  leetcodeId: number;
  title: string;
  titleCn: string | null;
  slug: string;
  difficulty: string;
  difficultyScore: number;
  contestRating?: number | null;
  topic: string | null;
  userStatus: string | null;
  userMastery: number | null;
  reviewCount: number;
  nextReviewAt: string | null;
  isCompleted: boolean;
  isRated: boolean;
}

interface ProblemCardProps {
  problem: DailyProblem;
  onComplete: (problemId: number) => void;
  onCoach?: (problem: DailyProblem) => void;
  className?: string;
}

const difficultyColors: Record<string, string> = {
  Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Hard: 'text-red-600 bg-red-50 border-red-200',
};

const difficultyLabels: Record<string, string> = {
  Easy: '简单',
  Medium: '中等',
  Hard: '困难',
};

/** Color for contest rating badge based on rating value */
function ratingColorClasses(rating: number): string {
  if (rating < 1400) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (rating <= 1800) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

export function ProblemCard({ problem, onComplete, onCoach, className }: ProblemCardProps) {
  const displayTitle = problem.titleCn || problem.title;
  const difficultyColor = difficultyColors[problem.difficulty] ?? 'text-muted-foreground bg-muted border-border';
  const rating = problem.contestRating ?? null;
  const ratingColor = rating ? ratingColorClasses(rating) : difficultyColor;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        problem.isCompleted && 'opacity-70',
        className,
      )}
    >
      {/* Gradient accent top */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400" />

      <div className="p-5">
        {/* Header row: LeetCode ID + difficulty badge + contest rating */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            #{problem.leetcodeId}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                difficultyColor,
              )}
            >
              {difficultyLabels[problem.difficulty] ?? problem.difficulty}
            </span>
            {rating !== null && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  ratingColor,
                )}
              >
                {Math.round(rating)}分
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-1 text-base font-semibold leading-snug tracking-tight">
          {displayTitle}
        </h3>
        {problem.titleCn && problem.title && (
          <p className="mb-3 text-sm text-muted-foreground">{problem.title}</p>
        )}

        {/* Topic tag */}
        {problem.topic && (
          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {problem.topic}
          </span>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* AI coach */}
          {onCoach && (
            <button
              onClick={() => onCoach(problem)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 教练
            </button>
          )}

          {/* LeetCode link */}
          <a
            href={`https://leetcode.cn/problems/${problem.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            跳转 LeetCode
          </a>

          {/* Complete button or completed state */}
          {problem.isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              已完成
              {problem.isRated && (
                <span className="ml-1 opacity-70">
                  · 评分 {problem.userMastery}
                </span>
              )}
            </span>
          ) : (
            <button
              onClick={() => onComplete(problem.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:scale-105 hover:shadow-sm active:scale-95"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              已做完
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
