'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Zap, BookOpen, Sparkles } from 'lucide-react';
import { TrackCard } from '@/components/home/track-card';
import { MainNav } from '@/components/nav/main-nav';

interface PlanInfo {
  id: number;
  name: string;
  totalProblems: number;
  description: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [planName, setPlanName] = useState<string | null>(null);
  const [planTotal, setPlanTotal] = useState<number>(0);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch plan info if user has a plan
  useEffect(() => {
    if (status !== 'authenticated') return;

    // If session already has planId, we know user has a plan
    const planId = session?.user?.planId;
    if (!planId) {
      setPlanName(null);
      return;
    }

    // Fetch plan details for display
    fetch('/api/plans')
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((plans: PlanInfo[]) => {
        const plan = plans.find((p) => p.id === planId);
        if (plan) {
          setPlanName(plan.name);
          setPlanTotal(plan.totalProblems);
        }
      })
      .catch(() => {
        setPlanName(null);
      });
  }, [status, session]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return null; // redirecting

  const hasPlan = session.user.planId != null;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            AI LeetCode 私教
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            选择适合你的方式，开始刷题
          </p>
        </div>

        {/* Two-track cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Track A: Casual practice */}
          <TrackCard
            icon={<Zap className="h-7 w-7" />}
            title="随便练练"
            subtitle="没有计划也能练"
            description="每天推送 3-5 道精选题目，从易到难循序渐进。做完即走，无需规划。"
            ctaLabel="开始练习"
            ctaHref="/daily"
            variant="primary"
          />

          {/* Track B: Structured plan */}
          {hasPlan ? (
            <TrackCard
              icon={<BookOpen className="h-7 w-7" />}
              title="我的计划"
              subtitle="按计划系统刷题"
              description="继续你的学习计划，追踪每道题的掌握程度，系统自动安排间隔复习。"
              ctaLabel="查看计划"
              ctaHref="/plans"
              variant="secondary"
              extra={
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  {planName || '学习计划'} · {planTotal} 题
                </div>
              }
            />
          ) : (
            <TrackCard
              icon={<BookOpen className="h-7 w-7" />}
              title="按计划刷"
              subtitle="结构化学习路径"
              description="选择核心面试 100 题或自定义专题，像墨墨背单词一样高效刷题。系统根据间隔重复算法安排每日任务。"
              ctaLabel="选择计划"
              ctaHref="/onboarding"
              variant="secondary"
            />
          )}
        </div>

        {/* Bottom hint */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          推荐先选一个学习计划，让系统帮你安排每日任务
        </p>
      </main>
    </div>
  );
}
