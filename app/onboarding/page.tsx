'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import {
  StepIndicator,
  PlanCard,
  QuotaSelector,
  CustomPreferences,
} from '@/components/onboarding';

// ── Types ──────────────────────────────────────────────────────────

interface Plan {
  id: number;
  name: string;
  totalProblems: number;
  description: string;
  topics?: string[];
}

type Step = 1 | 2 | 3;

// ── Constants ──────────────────────────────────────────────────────

const STEP_LABELS = ['选择计划', '每日题量', '个性定制'];

// ── Page Component ─────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [dailyQuota, setDailyQuota] = useState(5);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(80);

  // API state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomPlan = selectedPlanId === 3;

  // ── Auth guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // ── Fetch plans ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    async function fetchPlans() {
      try {
        setLoading(true);
        const res = await fetch('/api/plans');
        if (!res.ok) {
          throw new Error(`Failed to load plans (${res.status})`);
        }
        const data = await res.json();
        // API returns either { plans: [...] } or directly an array
        setPlans(Array.isArray(data) ? data : data.plans || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载计划失败');
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, [status]);

  // ── Navigation ───────────────────────────────────────────────────
  const goToStep = useCallback(
    (step: Step) => {
      // For non-custom plans, step 3 is confirmation (handled in render)
      setCurrentStep(step);
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (currentStep === 1 && selectedPlanId) {
      if (isCustomPlan) {
        // Custom plan: skip step 2, go to step 3 (preferences)
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      // Preset plan confirmation step
      setCurrentStep(3);
    }
  }, [currentStep, selectedPlanId, isCustomPlan]);

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      if (isCustomPlan) {
        // Custom: go back to step 1
        setCurrentStep(1);
      } else {
        // Preset: go back to step 2
        setCurrentStep(2);
      }
    }
  }, [currentStep, isCustomPlan]);

  // ── Topic toggle ─────────────────────────────────────────────────
  const handleToggleTopic = useCallback((topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }, []);

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedPlanId) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Select plan
      const planBody: Record<string, unknown> = { planId: selectedPlanId };
      if (isCustomPlan) {
        planBody.preferences = selectedTopics;
        planBody.totalProblems = totalQuestions;
      }

      const planRes = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planBody),
      });

      if (!planRes.ok) {
        const errData = await planRes.json().catch(() => ({}));
        throw new Error(errData.error || '计划选择失败');
      }

      // 2. Set daily quota
      const quotaRes = await fetch('/api/user/daily-quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyQuota: isCustomPlan ? 5 : dailyQuota }),
      });

      if (!quotaRes.ok) {
        const errData = await quotaRes.json().catch(() => ({}));
        throw new Error(errData.error || '题量设置失败');
      }

      // 3. Refresh session to get updated planId
      await update();
      // 4. Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
      setSubmitting(false);
    }
  }, [selectedPlanId, isCustomPlan, dailyQuota, selectedTopics, totalQuestions, router, update]);

  // ── Render helpers ───────────────────────────────────────────────

  const canProceed = (): boolean => {
    if (!selectedPlanId) return false;
    if (currentStep === 2 && !isCustomPlan) return dailyQuota > 0;
    if (currentStep === 3 && isCustomPlan) return selectedTopics.length > 0 && totalQuestions >= 30;
    return true;
  };

  // ── Loading state ────────────────────────────────────────────────
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // ── Unauthenticated (should redirect, but show nothing while redirecting) ──
  if (status === 'unauthenticated') {
    return null;
  }

  // ── Error fetching plans ─────────────────────────────────────────
  if (error && plans.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-destructive">加载失败</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button
            className="mt-6"
            onClick={() => window.location.reload()}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header area with gradient */}
      <div className="relative border-b">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Logo / title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-1 ring-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              开始你的刷题之旅
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              只需三步，个性化定制你的学习计划
            </p>
          </div>

          {/* Step indicator */}
          <StepIndicator
            currentStep={currentStep}
            totalSteps={3}
            labels={isCustomPlan ? ['选择计划', '跳过', '个性定制'] : STEP_LABELS}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          {/* Step 1: Plan selection */}
          {currentStep === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">选择学习计划</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  根据你的目标选择最适合的计划
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={selectedPlanId === plan.id}
                    onSelect={setSelectedPlanId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Daily quota (preset plans only) */}
          {currentStep === 2 && !isCustomPlan && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">设置每日题量</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  选择每天想要完成的题目数量
                </p>
              </div>

              <QuotaSelector value={dailyQuota} onChange={setDailyQuota} />
            </div>
          )}

          {/* Step 3: Custom preferences (custom plan only) */}
          {currentStep === 3 && isCustomPlan && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">自定义题型</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  选择你想要练习的题型和总题量
                </p>
              </div>

              <CustomPreferences
                selectedTopics={selectedTopics}
                totalQuestions={totalQuestions}
                onToggleTopic={handleToggleTopic}
                onTotalChange={setTotalQuestions}
              />
            </div>
          )}

          {/* Step 3: Confirmation (preset plans) */}
          {currentStep === 3 && !isCustomPlan && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">确认选择</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  确认你的学习计划后即可开始
                </p>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border bg-card p-6">
                <dl className="space-y-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">学习计划</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {plans.find((p) => p.id === selectedPlanId)?.name || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">总题量</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {plans.find((p) => p.id === selectedPlanId)?.totalProblems || '—'} 题
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-muted-foreground">每日题量</dt>
                    <dd className="text-sm font-semibold text-foreground">{dailyQuota} 题/天</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  上一步
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Next button (steps 1, 2) */}
              {((currentStep === 1) || (currentStep === 2 && !isCustomPlan)) && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-200',
                    canProceed()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  下一步
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {/* Submit button (final step) */}
              {currentStep === 3 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canProceed() || submitting}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-8 py-2.5 text-sm font-semibold transition-all duration-200',
                    canProceed() && !submitting
                      ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.98]'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      开始学习
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Fade-in animation */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out both;
        }
      `}</style>
    </div>
  );
}
