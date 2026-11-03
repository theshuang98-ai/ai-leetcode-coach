'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function PreorderForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setErrorMsg('请输入邮箱地址');
      setState('error');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setErrorMsg('请输入有效的邮箱地址');
      setState('error');
      return;
    }

    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/preorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '提交失败');
      }

      setState('success');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : '提交失败，请稍后再试');
    }
  };

  if (state === 'success') {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center rounded-2xl border bg-card p-10 text-center"
        style={{ animation: 'fade-in-up 0.4s ease-out both' }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="mt-5 text-xl font-bold tracking-tight">预约成功！</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          我们已收到你的邮箱{' '}
          <span className="font-medium text-foreground">{email}</span>
          ，上线后将第一时间通知你。
        </p>
        <p className="mt-4 text-xs text-muted-foreground/60">
          你的邮箱仅用于上线通知，不会用于其他用途。
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-md"
      id="preorder-form"
      style={{ animation: 'fade-in-up 0.4s ease-out both' }}
    >
      <form
        onSubmit={handleSubmit}
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-card p-6 shadow-lg shadow-foreground/5 transition-all duration-300 sm:p-8',
          state === 'error' && 'border-destructive/30',
        )}
      >
        {/* Gradient accent */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400" />

        <div className="mb-5 text-center">
          <h3 className="text-xl font-bold tracking-tight">抢先预约</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            留下邮箱，上线第一时间通知你
          </p>
        </div>

        {/* Input group */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === 'error') setState('idle');
              }}
              placeholder="your@email.com"
              disabled={state === 'loading'}
              className={cn(
                'h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition-all duration-200',
                'placeholder:text-muted-foreground/40',
                'focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5',
                'disabled:cursor-not-allowed disabled:opacity-50',
                state === 'error' && 'border-destructive/50 focus:border-destructive/50 focus:ring-destructive/10',
              )}
            />
          </div>

          <button
            type="submit"
            disabled={state === 'loading'}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background shadow-lg shadow-foreground/10',
              'transition-all duration-300',
              'hover:scale-[1.02] hover:shadow-xl',
              'active:scale-[0.98]',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {state === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                提交中
              </>
            ) : (
              '立即预约'
            )}
          </button>
        </div>

        {/* Error message */}
        {state === 'error' && errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground/50">
          无需绑定信用卡 · 不发送垃圾邮件
        </p>
      </form>

      <style jsx>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
