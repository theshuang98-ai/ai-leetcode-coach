'use client';

import { Puzzle, Shuffle, Compass, Brain } from 'lucide-react';

const pains = [
  {
    icon: Puzzle,
    title: '没套路',
    description: '刷了几百题，还是总结不出每类题的通用解法框架。每次遇到新题都从零开始。',
    color: 'from-rose-500/20 to-rose-500/5',
    iconColor: 'text-rose-400',
  },
  {
    icon: Shuffle,
    title: '难度乱',
    description: 'Easy 和 Hard 混着刷，没有循序渐进的难度阶梯。要么太简单浪费时间，要么太难丧失信心。',
    color: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-400',
  },
  {
    icon: Compass,
    title: '没方向',
    description: '面对2000+道题不知道从哪开始。盲目跟风热门题单，不清楚哪些题对自己的目标公司真正重要。',
    color: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
  },
  {
    icon: Brain,
    title: '记不住',
    description: '做完就忘，一周后像没见过一样。缺乏科学的间隔重复机制，复习全凭感觉。',
    color: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
  },
];

export function PainPoints() {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-14 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Why It Hurts
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            刷题的痛，我们都懂
          </h2>
          <p className="mt-3 text-muted-foreground">
            每一个认真刷过 LeetCode 的人都经历过的四个阶段
          </p>
        </div>

        {/* Pain points grid — asymmetric staggered layout */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pains.map((pain, i) => {
            const Icon = pain.icon;
            return (
              <div
                key={pain.title}
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5"
                style={{
                  animationDelay: `${0.15 * i}s`,
                  animation: 'fade-in-up 0.5s ease-out both',
                }}
              >
                {/* Gradient accent at top */}
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${pain.color}`}
                />

                {/* Icon */}
                <div
                  className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${pain.color} p-3`}
                >
                  <Icon className={`h-5 w-5 ${pain.iconColor}`} />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold tracking-tight">
                  {pain.title}
                </h3>

                {/* Description */}
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pain.description}
                </p>

                {/* Hover border glow */}
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
