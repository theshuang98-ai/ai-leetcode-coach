'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CelebrationProps {
  isVisible: boolean;
  onDismiss: () => void;
}

const PARTICLE_COLORS = [
  'bg-emerald-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-cyan-400',
  'bg-fuchsia-400',
  'bg-lime-400',
];

const PARTICLE_COUNT = 40;

interface Particle {
  id: number;
  color: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] as string,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
}

export function Celebration({ isVisible, onDismiss }: CelebrationProps) {
  const [particles] = useState<Particle[]>(generateParticles);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm cursor-pointer"
        onClick={onDismiss}
      />

      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className={cn('absolute rounded-sm', p.color)}
            style={{
              left: `${p.left}%`,
              top: '-10px',
              width: p.size,
              height: p.size * (0.4 + Math.random() * 1.2),
              animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s both, confetti-shake ${p.duration * 0.3}s ease-in-out ${p.delay}s infinite`,
              transform: `rotate(${p.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Celebration card */}
      <div className="relative flex w-full max-w-sm flex-col items-center rounded-2xl border bg-card p-8 shadow-2xl">
        <span className="mb-3 text-6xl">🎉</span>
        <h2 className="text-2xl font-bold tracking-tight">今日任务完成</h2>
        <p className="mt-2 text-sm text-muted-foreground">太棒了！你今天的所有题目都已完成</p>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          继续保持这个节奏
        </div>

        <button
          onClick={onDismiss}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-lg active:scale-95"
        >
          知道了
        </button>
      </div>

      {/* Confetti keyframes */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes confetti-shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
      `}</style>
    </div>
  );
}
