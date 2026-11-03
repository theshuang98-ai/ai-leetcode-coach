'use client';

import Link from 'next/link';
import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Hero() {
  const scrollToForm = () => {
    document.getElementById('preorder-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 animate-[hero-glow_8s_ease-in-out_infinite] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, hsl(222.2 84% 60% / 0.3), hsl(222.2 84% 60% / 0) 70%)',
          }}
        />
        <div
          className="absolute top-20 right-0 h-[400px] w-[400px] animate-[hero-glow_8s_ease-in-out_infinite_2s] rounded-full opacity-15 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, hsl(262 83% 58% / 0.25), hsl(262 83% 58% / 0) 70%)',
          }}
        />
        <div
          className="absolute -bottom-20 left-0 h-[350px] w-[350px] animate-[hero-glow_8s_ease-in-out_infinite_4s] rounded-full opacity-15 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, hsl(180 70% 45% / 0.2), hsl(180 70% 45% / 0) 70%)',
          }}
        />
      </div>

      {/* Subtle dot pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Badge */}
      <div
        className="animate-fade-in mb-8 inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm"
        style={{ animationDelay: '0.1s' }}
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <span>MVP 演示版 · 本地已跑通</span>
      </div>

      {/* Headline */}
      <h1
        className="animate-fade-in max-w-3xl text-center text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
        style={{ animationDelay: '0.2s' }}
      >
        AI LeetCode{' '}
        <span
          className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent"
        >
          私教
        </span>
      </h1>

      {/* Subheadline */}
      <p
        className="animate-fade-in mt-6 max-w-xl text-center text-lg leading-relaxed text-muted-foreground sm:text-xl"
        style={{ animationDelay: '0.35s' }}
      >
        智能刷题教练
        <span className="mx-2 text-border">·</span>
        科学规划
        <span className="mx-2 text-border">·</span>
        每日推送
        <span className="mx-2 text-border">·</span>
        自适应复习
      </p>

      {/* Key stats / mini value props */}
      <div
        className="animate-fade-in mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground sm:gap-10"
        style={{ animationDelay: '0.5s' }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          个性化学习路径
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400" />
          遗忘曲线算法
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-violet-400" />
          每日3题精选
        </div>
      </div>

      {/* CTA */}
      <div
        className="animate-fade-in mt-12 flex flex-wrap items-center justify-center gap-3"
        style={{ animationDelay: '0.65s' }}
      >
        <Link
          href="/home"
          className={cn(
            'group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3.5 text-base font-semibold text-background shadow-lg shadow-foreground/10',
            'transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-foreground/15',
            'active:scale-[0.98]',
          )}
        >
          进入产品演示
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
        <button
          onClick={scrollToForm}
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          立即预约
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      {/* Needed keyframes */}
      <style jsx>{`
        @keyframes hero-glow {
          0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.2; }
          50% { transform: translate(-50%, -5%) scale(1.1); opacity: 0.25; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out both;
        }
        .animate-\\[hero-glow_8s_ease-in-out_infinite\\] {
          animation: hero-glow 8s ease-in-out infinite;
        }
        .animate-\\[hero-glow_8s_ease-in-out_infinite_2s\\] {
          animation: hero-glow 8s ease-in-out 2s infinite;
        }
        .animate-\\[hero-glow_8s_ease-in-out_infinite_4s\\] {
          animation: hero-glow 8s ease-in-out 4s infinite;
        }
      `}</style>
    </section>
  );
}
