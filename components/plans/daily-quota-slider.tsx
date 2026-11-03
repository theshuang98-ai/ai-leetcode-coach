'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SlidersHorizontal, Loader2, Check } from 'lucide-react';

interface DailyQuotaSliderProps {
  value: number;
  onQuotaChange: (v: number) => void;
  disabled?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function DailyQuotaSlider({
  value,
  onQuotaChange,
  disabled = false,
}: DailyQuotaSliderProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousValueRef = useRef(value);

  // Sync previousValueRef when value is updated externally
  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  const effectiveRate = value - Math.ceil(value * 0.3);
  const fillPercent = ((value - 1) / 9) * 100;

  const saveQuota = useCallback(
    async (newValue: number) => {
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/user/daily-quota', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dailyQuota: newValue }),
        });
        if (!res.ok) throw new Error('Save failed');
        const data = await res.json();
        previousValueRef.current = data.dailyQuota ?? newValue;
        setSaveStatus('saved');

        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(
          () => setSaveStatus('idle'),
          2000,
        );
      } catch {
        setSaveStatus('error');
        onQuotaChange(previousValueRef.current);

        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(
          () => setSaveStatus('idle'),
          3000,
        );
      }
    },
    [onQuotaChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    onQuotaChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveQuota(newValue), 500);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      {/* Header: Icon + Label + Value */}
      <div className="mb-3 flex items-center gap-2.5">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-violet-500" />
        <span className="text-sm font-medium text-foreground">每日题量</span>
        <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
          {value} 题/天
        </span>
      </div>

      {/* Slider track */}
      <div className="relative w-full py-1">
        {/* Unfilled track */}
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-secondary" />
        {/* Filled track */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-[width] duration-75"
          style={{ width: `${fillPercent}%` }}
        />
        {/* Range input (transparent for interaction, thumb is styled) */}
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="
            relative w-full appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-violet-500
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:shadow-violet-500/20
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-150
            hover:[&::-webkit-slider-thumb]:scale-110
            active:[&::-webkit-slider-thumb]:scale-95
            disabled:pointer-events-none
            disabled:[&::-webkit-slider-thumb]:cursor-not-allowed
            disabled:[&::-webkit-slider-thumb]:border-muted-foreground/30
            disabled:[&::-webkit-slider-thumb]:bg-muted
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-violet-500
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-track]:h-0
            [&::-moz-range-track]:bg-transparent
            [&::-moz-range-track]:border-0
          "
        />
      </div>

      {/* Footer: hint + save status */}
      <div className="mt-2.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          有效学习约 {effectiveRate} 题/天
        </p>
        <div className="flex items-center gap-1 text-xs">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">保存中...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="font-medium text-emerald-600">已保存</span>
            </>
          )}
          {saveStatus === 'error' && (
            <span className="text-destructive">保存失败，已恢复</span>
          )}
        </div>
      </div>
    </div>
  );
}
