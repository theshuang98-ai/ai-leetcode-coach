'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { PricingCard } from '@/components/subscribe/PricingCard';
import { SubscriptionStatus } from '@/components/subscribe/SubscriptionStatus';

type SubStatus = 'free' | 'trial' | 'active' | 'canceled' | 'past_due';

interface StatusData {
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}

export default function SubscribePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subData, setSubData] = useState<StatusData | null>(null);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/payment/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSubData(data);
      })
      .catch((err) => setError(err.message || '获取订阅状态失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (authStatus === 'loading') return;
    fetchStatus();
  }, [authStatus, router, fetchStatus]);

  // Auth loading state
  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated — redirect handled in useEffect, show nothing
  if (authStatus === 'unauthenticated') {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            订阅
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {subData?.status === 'active'
              ? '你的订阅'
              : subData?.status === 'trial'
                ? '试用中'
                : '升级你的学习体验'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {subData?.status === 'active'
              ? '感谢你的支持，畅享全部功能'
              : subData?.status === 'trial'
                ? '试用结束后自动续订，可随时取消'
                : '¥99/月，7天免费试用，随时取消'}
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">加载中...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="text-center">
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
            <button
              onClick={fetchStatus}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          </div>
        )}

        {/* Content based on status */}
        {!loading && !error && subData && (
          <>
            {/* Active subscriber */}
            {subData.status === 'active' && (
              <SubscriptionStatus
                status="active"
                currentPeriodEnd={subData.currentPeriodEnd}
              />
            )}

            {/* Trial user */}
            {subData.status === 'trial' && (
              <div className="space-y-8">
                <SubscriptionStatus
                  status="trial"
                  trialEndsAt={subData.trialEndsAt}
                />
                <PricingCard showTrialBadge={false} />
              </div>
            )}

            {/* Canceled subscriber */}
            {subData.status === 'canceled' && (
              <SubscriptionStatus
                status="canceled"
                currentPeriodEnd={subData.currentPeriodEnd}
              />
            )}

            {/* Past due */}
            {subData.status === 'past_due' && (
              <SubscriptionStatus status="past_due" />
            )}

            {/* Free user — show pricing card */}
            {subData.status === 'free' && <PricingCard showTrialBadge />}
          </>
        )}
      </div>
    </main>
  );
}
