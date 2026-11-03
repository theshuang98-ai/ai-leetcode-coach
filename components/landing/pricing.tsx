'use client';

import { Check, ArrowRight } from 'lucide-react';

const features = [
  '个性化学习路径 — 根据目标公司自动规划',
  '每日 3 道智能推送 — 从易到难循序渐进',
  '遗忘曲线间隔复习 — SM-2 算法科学记忆',
  '进度可视化仪表盘 — 清晰追踪成长轨迹',
  '题解提示引导 — 鼓励独立思考不直接给答案',
  '优先级支持 — 48 小时内响应你的反馈',
];

export function Pricing() {
  const scrollToForm = () => {
    document.getElementById('preorder-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            简单透明的定价
          </h2>
          <p className="mt-3 text-muted-foreground">
            上线特惠 · 抢先预约锁定优惠
          </p>
        </div>

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
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              7 天免费试用
            </div>
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

          {/* CTA */}
          <button
            onClick={scrollToForm}
            className="group mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
          >
            抢先预约
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>

          {/* Fine print */}
          <p className="mt-4 text-center text-xs text-muted-foreground/60">
            无需绑定信用卡 · 7天后可随时取消
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
