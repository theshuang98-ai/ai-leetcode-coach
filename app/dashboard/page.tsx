'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ProgressRing,
  TopicHeatmap,
  ReviewCalendar,
  StatsCards,
  DashboardSkeleton,
} from '@/components/dashboard';
import { MainNav } from '@/components/nav/main-nav';

// ── Types matching GET /api/dashboard ──────────────────────

interface DashboardData {
  totalProgress: { solved: number; total: number; percent: number };
  topicHeatmap: Record<
    string,
    { solved: number; total: number; avgMastery: number }
  >;
  calendar: { date: string; count: number }[];
  streak: number;
  estimatedCompletion: { daysRemaining: number; date: string };
}

// ── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch dashboard data
  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/dashboard');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error(`Failed to fetch dashboard: ${res.status}`);
        }
        const json: DashboardData = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [status, router]);

  // ── Loading state ────────────────────────────────────
  if (status === 'loading' || loading) {
    return <DashboardSkeleton />;
  }

  // ── Auth redirect guard ──────────────────────────────
  if (!session) {
    return null; // will redirect via useEffect
  }

  // ── Error state ──────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">加载失败</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state (no problems assigned) ───────────────
  if (!data || data.totalProgress.total === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <span className="text-3xl">📚</span>
          </div>
          <h2 className="text-xl font-semibold">你还没有开始学习计划</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            选择一个学习计划开始你的 LeetCode 刷题之旅
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            开始学习计划
          </Link>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────
  const { totalProgress, topicHeatmap, calendar, streak, estimatedCompletion } =
    data;
  const remaining = totalProgress.total - totalProgress.solved;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          学习仪表盘
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          追踪你的刷题进度与学习数据
        </p>
      </div>

      {/* Block 4 — Stats Cards (placed first for visual hierarchy) */}
      <StatsCards
        streak={streak}
        remaining={remaining}
        estimatedCompletion={estimatedCompletion}
      />

      {/* Block 1 — Progress Ring */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">总进度</h2>
        <ProgressRing
          solved={totalProgress.solved}
          total={totalProgress.total}
          percent={totalProgress.percent}
        />
      </section>

      {/* Block 2 — Topic Heatmap */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">知识点掌握情况</h2>
        <TopicHeatmap topicHeatmap={topicHeatmap} />
      </section>

      {/* Block 3 — Review Calendar */}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">打卡日历</h2>
        <p className="mb-4 text-sm text-muted-foreground">过去 30 天</p>
        <ReviewCalendar calendar={calendar} />
      </section>
    </main>
    </div>
  );
}
