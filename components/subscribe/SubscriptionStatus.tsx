'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, XCircle, AlertTriangle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusType = 'active' | 'trial' | 'canceled' | 'past_due';

interface SubscriptionStatusProps {
  status: StatusType;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

/** Format an ISO date string to YYYY-MM-DD in zh-CN locale */
function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Calculate remaining trial days from trialEndsAt */
function getRemainingTrialDays(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function SubscriptionStatus({
  status,
  trialEndsAt,
  currentPeriodEnd,
}: SubscriptionStatusProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/payment/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || '创建支付会话失败');
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('未获取到支付链接');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Active status
  if (status === 'active') {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 p-8 sm:p-10">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">已订阅</span>
          </div>

          <p className="mt-4 text-2xl font-bold">畅享全部功能</p>

          {/* Next billing */}
          {currentPeriodEnd && (
            <p className="mt-2 text-sm text-muted-foreground">
              下次扣款:{' '}
              <span className="font-medium text-foreground">
                {formatDate(currentPeriodEnd)}
              </span>
            </p>
          )}

          {/* Manage subscription button */}
          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-300 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {actionLoading ? '处理中...' : '管理订阅'}
            </button>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground/60">
            点击管理订阅可在 Stripe 中更新支付方式或取消
          </p>
        </div>
      </div>
    );
  }

  // Trial status
  if (status === 'trial') {
    const remainingDays = getRemainingTrialDays(trialEndsAt);

    return (
      <div className="rounded-2xl border-2 border-blue-500/20 bg-blue-500/5 p-8 sm:p-10">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">试用中</span>
          </div>

          {/* Countdown */}
          <div className="mt-4">
            <span className="text-4xl font-extrabold tracking-tight">
              {remainingDays}
            </span>
            <span className="ml-2 text-lg text-muted-foreground">天剩余</span>
          </div>

          {trialEndsAt && (
            <p className="mt-2 text-sm text-muted-foreground">
              试用期至 {formatDate(trialEndsAt)}
            </p>
          )}

          {/* Early subscribe CTA */}
          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {actionLoading ? '正在跳转...' : '立即订阅'}
            </button>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground/60">
            随时可提前订阅，试用期结束后自动续订
          </p>
        </div>
      </div>
    );
  }

  // Canceled status
  if (status === 'canceled') {
    return (
      <div className="rounded-2xl border-2 border-border bg-muted/30 p-8 sm:p-10">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              已取消
            </span>
          </div>

          <p className="mt-4 text-xl font-semibold">订阅已取消</p>

          {currentPeriodEnd && (
            <p className="mt-2 text-sm text-muted-foreground">
              订阅将于{' '}
              <span className="font-medium text-foreground">
                {formatDate(currentPeriodEnd)}
              </span>{' '}
              到期
            </p>
          )}

          {/* Restore button */}
          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {actionLoading ? '处理中...' : '恢复订阅'}
            </button>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Past due status
  if (status === 'past_due') {
    return (
      <div className="rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 p-8 sm:p-10">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">支付异常</span>
          </div>

          <p className="mt-4 text-xl font-semibold">支付出现问题</p>

          <p className="mt-2 text-sm text-muted-foreground">
            你的最近一次付款未成功，请更新支付方式以继续使用
          </p>

          {/* Update payment button */}
          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {actionLoading ? '处理中...' : '更新支付方式'}
            </button>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
