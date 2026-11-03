import { Hero } from '@/components/landing/hero';
import { PainPoints } from '@/components/landing/pain-points';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { PreorderForm } from '@/components/landing/preorder-form';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />

      {/* Subtle section divider */}
      <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-border to-transparent" />

      <PainPoints />

      <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-border to-transparent" />

      <HowItWorks />

      <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-border to-transparent" />

      <Pricing />

      <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Pre-order section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            抢先预约
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            成为第一批用户
          </h2>
          <p className="mt-3 text-muted-foreground">
            上线时你将第一时间收到通知
          </p>
        </div>
        <PreorderForm />
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm text-muted-foreground">
            感谢{' '}
            <a
              href="https://github.com/EndlessCheng"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/50"
            >
              灵茶山艾府
            </a>{' '}
            题单框架启发
          </p>
          <p className="mt-3 text-xs text-muted-foreground/50">
            AI LeetCode 私教 · 智能刷题教练
          </p>
        </div>
      </footer>
    </main>
  );
}
