'use client';

import { ListChecks, CalendarCheck, RefreshCw } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: ListChecks,
    title: '选计划',
    description: '选择目标公司（Google/Meta/ByteDance）或算法专题（DP/图论/二分），系统自动生成个性化学习路径。',
    highlight: '支持 20+ 公司标签 & 15 个算法专题',
  },
  {
    number: '02',
    icon: CalendarCheck,
    title: '每日刷',
    description: '每天推送 3 道精选题目，从易到难循序渐进。每道题配有提示引导，鼓励独立思考。',
    highlight: '每日 3 题 · 约 45 分钟',
  },
  {
    number: '03',
    icon: RefreshCw,
    title: '自适应复习',
    description: '基于艾宾浩斯遗忘曲线的间隔重复算法，在你快要遗忘时自动安排复习，让每道题的解法刻进肌肉记忆。',
    highlight: 'SM-2 算法驱动 · 科学记忆',
  },
];

export function HowItWorks() {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            三步开启高效刷题
          </h2>
          <p className="mt-3 text-muted-foreground">
            从迷茫到清晰，只需要三个步骤
          </p>
        </div>

        {/* Steps */}
        <div className="relative space-y-8">
          {/* Vertical connecting line */}
          <div className="absolute top-12 bottom-12 left-[27px] hidden w-px bg-gradient-to-b from-border via-foreground/20 to-border sm:block" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="group relative flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-start sm:gap-6 sm:p-8"
                style={{
                  animationDelay: `${0.2 + i * 0.15}s`,
                  animation: 'fade-in-up 0.5s ease-out both',
                }}
              >
                {/* Step number + icon */}
                <div className="relative flex shrink-0 items-center gap-4 sm:flex-col sm:items-center sm:gap-2 sm:w-[100px]">
                  {/* Number circle */}
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-lg font-bold text-background shadow-lg shadow-foreground/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground sm:mt-1">
                    STEP {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {step.highlight}
                  </div>
                </div>

                {/* Hover ring */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-border transition-colors duration-300 group-hover:ring-foreground/10" />
              </div>
            );
          })}
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
