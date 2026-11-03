'use client';

import { useEffect, useState, useRef } from 'react';

interface ProgressRingProps {
  solved: number;
  total: number;
  percent: number;
}

export function ProgressRing({ solved, total, percent }: ProgressRingProps) {
  const [offset, setOffset] = useState(283); // 2 * PI * 45 ≈ 283 (full circumference)
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // Trigger animation on next frame
    const raf = requestAnimationFrame(() => {
      if (mounted.current) {
        setOffset(283 - (283 * percent) / 100);
      }
    });
    return () => {
      mounted.current = false;
      cancelAnimationFrame(raf);
    };
  }, [percent]);

  return (
    <div className="flex flex-col items-center">
      {/* Ring */}
      <div className="relative h-40 w-40">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="283"
            strokeDashoffset={offset}
            className="text-blue-500 transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{percent}%</span>
        </div>
      </div>

      {/* Label */}
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{solved}</span>
        <span>/{total} 题已完成</span>
      </p>
    </div>
  );
}
