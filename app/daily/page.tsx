'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ProblemCard, type DailyProblem } from '@/components/daily/ProblemCard';
import { RatingModal } from '@/components/daily/RatingModal';
import { Celebration } from '@/components/daily/Celebration';
import { SyncButton } from '@/components/daily/SyncButton';
import { CoachPanel } from '@/components/coach/CoachPanel';
import { MainNav } from '@/components/nav/main-nav';
import { cn } from '@/lib/utils';

interface DailyPushResponse {
  id: string;
  date: string;
  isComplete: boolean;
  problemCount: number;
  completedCount: number;
  problems: DailyProblem[];
}

interface CompleteResponse {
  success: boolean;
  completedIds: number[];
  isComplete: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  // Dates are stored as UTC midnight of the local day — read them back in UTC.
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[d.getUTCDay()];
  return `${year}年${month}月${day}日 周${weekday}`;
}

export default function DailyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dailyPush, setDailyPush] = useState<DailyPushResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingProblem, setRatingProblem] = useState<DailyProblem | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [coachProblem, setCoachProblem] = useState<DailyProblem | null>(null);

  const wasCompleteRef = useRef(false);
  const celebrationShownRef = useRef(false);

  // Auth guard: redirect unauthenticated (skip in dev mode)
  useEffect(() => {
    if (status === 'authenticated') return; // skip if already authed
    if (status === 'loading') return; // wait for session check
    // In production, redirect unauthenticated users
    // In dev, allow access for testing
  }, [status, router]);

  const fetchDailyPush = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/daily-push', { credentials: 'include' });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }

      const data: DailyPushResponse = await res.json();

      // Detect transition from incomplete to complete, show celebration once
      if (
        !wasCompleteRef.current &&
        data.isComplete &&
        !celebrationShownRef.current
      ) {
        celebrationShownRef.current = true;
        setShowCelebration(true);
      }
      wasCompleteRef.current = data.isComplete;

      setDailyPush(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取每日推送失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDailyPush();
    }
  }, [status, fetchDailyPush]);

  // Called when user clicks "已做完" on a problem card
  const handleCompleteClick = useCallback(
    (problemId: number) => {
      const problem = dailyPush?.problems.find((p) => p.id === problemId);
      if (problem) {
        setRatingProblem(problem);
      }
    },
    [dailyPush],
  );

  // Called when user rates a problem in the modal
  const handleRate = useCallback(
    async (problemId: number, mastery: number) => {
      try {
        setSubmittingId(problemId);
        setRatingProblem(null);

        const res = await fetch('/api/daily-push/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ problemId, mastery, rating: mastery }),
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '提交失败');
        }

        const result: CompleteResponse = await res.json();

        // Update local state optimistically
        setDailyPush((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            completedCount: result.completedIds.length,
            isComplete: result.isComplete,
            problems: prev.problems.map((p) =>
              p.id === problemId
                ? { ...p, isCompleted: true, isRated: true, userMastery: mastery }
                : p,
            ),
          };
        });

        // Show celebration if all complete
        if (result.isComplete && !celebrationShownRef.current) {
          celebrationShownRef.current = true;
          setShowCelebration(true);
        }
      } catch (e) {
        console.error('Failed to complete problem:', e);
        setError(e instanceof Error ? e.message : '提交失败，请重试');
      } finally {
        setSubmittingId(null);
      }
    },
    [router],
  );

  const handleCloseRating = useCallback(() => {
    setRatingProblem(null);
  }, []);

  const handleDismissCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (status === 'unauthenticated') {
    return null;
  }

  // ── Loading state (after auth, during data fetch) ─────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="text-4xl">📚</span>
            <p className="text-sm text-muted-foreground">加载今日任务...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <span className="mb-4 block text-6xl">😵</span>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">出错了</h1>
          <p className="mb-8 text-muted-foreground">{error}</p>
          <button
            onClick={fetchDailyPush}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            重试
          </button>
        </div>
      </div>
      </div>
    );
  }

  // ── Empty state (no push or no problems) ─────────────────────────────
  if (!dailyPush || dailyPush.problems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <span className="mb-4 block text-6xl">📋</span>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">今日暂无推送任务</h1>
          <p className="text-muted-foreground">
            你可能还没有设置每日题量，或者所有题目都已完成
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={fetchDailyPush}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-md active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              生成今日推送
            </button>
            <button
              onClick={() => router.push('/home')}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────
  const progressPct =
    dailyPush.problemCount > 0
      ? (dailyPush.completedCount / dailyPush.problemCount) * 100
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  每日推送
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDate(dailyPush.date)}
                </p>
              </div>
              <SyncButton />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-primary">
                {dailyPush.completedCount}
                <span className="text-xl text-muted-foreground">/{dailyPush.problemCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">已完成</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Problem list */}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dailyPush.problems.map((problem) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              onComplete={handleCompleteClick}
              onCoach={setCoachProblem}
              className={cn(submittingId === problem.id && 'pointer-events-none opacity-60')}
            />
          ))}
        </div>

          {/* All done banner (after celebration dismissed or on revisit) */}
        {dailyPush.isComplete && !showCelebration && (
          <div className="mt-6 rounded-xl border bg-card p-6 text-center shadow-sm">
            <span className="mb-2 block text-4xl">🎯</span>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              今天的练习全部完成！
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              “Talk is cheap. Show me the code.” — Linus Torvalds
            </p>
          </div>
        )}
      </main>

      {/* AI coach drawer */}
      <CoachPanel problem={coachProblem} onClose={() => setCoachProblem(null)} />

      {/* Rating modal */}
      <RatingModal
        isOpen={ratingProblem !== null}
        problem={ratingProblem}
        onRate={handleRate}
        onClose={handleCloseRating}
      />

      {/* Celebration */}
      <Celebration
        isVisible={showCelebration}
        onDismiss={handleDismissCelebration}
      />
    </div>
  );
}
