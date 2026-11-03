'use client';

import { useState } from 'react';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  '每日智能推送 — 从易到难循序渐进',
  '自适应复习计划 — SM-2 算法科学记忆',
  '进度可视化仪表盘 — 清晰追踪成长轨迹',
  'Chrome 插件 — 随时随地方便刷题',
];

interface PricingCardProps {
  showTrialBadge?: boolean;
  className?: string;
}

export function PricingCard({ showTrialBadge = true, className }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : '支付初始化失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-8', className)}>
      {/* Pricing card */}
      <div
        className="relative overflow-hidden rounded-3xl border-2 bg-card p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-foreground/5 sm:p-10"
        style={{
          animation: 'fade-in-up 0.5s ease-out 0.1s both',
          borderColor: 'hsl(var(--foreground) / 0.08)',
        }}
      >
        {/* Gradient accent top */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400" />

        {/* Price */}
        <div className="text-center">
          <div className="inline-flex items-baseline gap-1">
            <span className="text-5xl font-extrabold tracking-tight">¥99</span>
            <span className="text-lg text-muted-foreground">/月</span>
          </div>
          {showTrialBadge && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              7 天免费试用
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Feature list */}
        <ul className="space-y-4">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <span className="text-sm leading-relaxed text-muted-foreground">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="group mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          )}
          {loading ? '正在跳转...' : '立即订阅'}
        </button>

        {/* Fine print */}
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          无需绑定信用卡 · 7天后可随时取消
        </p>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
