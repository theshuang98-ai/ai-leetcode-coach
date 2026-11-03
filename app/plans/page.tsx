'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight, PlusCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { MainNav } from '@/components/nav/main-nav';
import { computeETA } from '@/lib/eta';
import { DailyQuotaSlider } from '@/components/plans/daily-quota-slider';
import { TopicBreakdown } from '@/components/plans/topic-breakdown';
import { TOPIC_NAMES } from '@/lib/constants/topics';

interface PlanInfo {
  id: number;
  name: string;
  totalProblems: number;
  description: string;
  topics: string[];
}

interface UserProblemStat {
  total: number;
  solved: number;
  percent: number;
}

interface TopicHeatmapEntry {
  solved: number;
  total: number;
  avgMastery: number;
}

export default function PlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [stats, setStats] = useState<UserProblemStat | null>(null);
  const [dailyQuota, setDailyQuota] = useState(5);
  const [topicHeatmap, setTopicHeatmap] = useState<Record<string, TopicHeatmapEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const planId = session.user.planId;

    Promise.all([
      fetch('/api/plans').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/dashboard').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/user/daily-quota').then((r) =>
        r.ok ? r.json() : { dailyQuota: 5 },
      ),
    ])
      .then(([plans, dashData, quotaData]) => {
        if (planId) setPlan(plans.find((p: PlanInfo) => p.id === planId) || null);
        if (dashData?.totalProgress) setStats(dashData.totalProgress);
        if (dashData?.topicHeatmap) setTopicHeatmap(dashData.topicHeatmap);
        if (quotaData?.dailyQuota) setDailyQuota(quotaData.dailyQuota);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [status, session]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  const hasPlan = session.user.planId != null && plan != null;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            我的计划
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasPlan ? '追踪你的学习进度' : '选择一个计划开始系统刷题'}
          </p>
        </div>

        {!hasPlan ? (
          /* Empty state — no plan */
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              还没有学习计划
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              选择 Hot 100 计划，按专题系统刷通核心面试题
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-md active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              选择计划
            </Link>
          </div>
        ) : (
          /* Plan overview */
          <div className="space-y-6">
            {/* Plan summary card */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <BookOpen className="h-4 w-4 text-violet-600" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {plan!.name}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan!.description}
                  </p>

                  {/* Topics */}
                  {plan!.topics && plan!.topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {plan!.topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                        >
                          {TOPIC_NAMES[topic] || topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress ring */}
                {stats && stats.total > 0 && (
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="relative h-20 w-20">
                      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 72 72">
                        <circle
                          cx="36" cy="36" r="30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="6"
                          className="text-secondary"
                        />
                        <circle
                          cx="36" cy="36" r="30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="6"
                          strokeLinecap="round"
                          className="text-violet-500"
                          strokeDasharray={`${(stats.percent / 100) * 188.5} 188.5`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {stats.percent}%
                        </span>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">
                        {stats.solved}/{stats.total}
                      </p>
                      <p className="text-xs text-muted-foreground">已完成</p>

                      {/* ETA */}
                      {dailyQuota > 0 && (() => {
                        const eta = computeETA(dailyQuota, plan!.totalProblems, stats.solved);
                        return (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            {eta.daysRemaining === 0 ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-600">
                                  全部完成!
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    预计 {eta.daysRemaining} 天后完成
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                                  {eta.date}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Daily quota slider — card footer */}
              <div className="mt-5 border-t pt-5">
                <DailyQuotaSlider value={dailyQuota} onQuotaChange={setDailyQuota} />
              </div>
            </div>

            {/* Topic breakdown */}
            {topicHeatmap && plan!.topics.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">知识板块</h3>
                <TopicBreakdown topics={plan!.topics} topicData={topicHeatmap} />
              </div>
            )}

            {/* Quick actions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/daily"
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ArrowRight className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">去刷今天的题</p>
                  <p className="text-xs text-muted-foreground">
                    从计划中推送今日任务
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              <Link
                href="/onboarding"
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <BookOpen className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">更换计划</p>
                  <p className="text-xs text-muted-foreground">
                    重新选择学习路径
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
