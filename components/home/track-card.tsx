'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export interface TrackCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  variant: 'primary' | 'secondary';
  /** Optional extra info shown below description (e.g. plan name + progress) */
  extra?: React.ReactNode;
}

const gradientMap = {
  primary:
    'from-emerald-500/10 via-sky-500/5 to-transparent',
  secondary:
    'from-violet-500/10 via-fuchsia-500/5 to-transparent',
};

const borderMap = {
  primary: 'border-emerald-500/20 hover:border-emerald-500/40',
  secondary: 'border-violet-500/20 hover:border-violet-500/40',
};

const iconBgMap = {
  primary: 'bg-emerald-500/10 text-emerald-600',
  secondary: 'bg-violet-500/10 text-violet-600',
};

const ctaMap = {
  primary:
    'bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30',
  secondary:
    'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30',
};

export function TrackCard({
  icon,
  title,
  subtitle,
  description,
  ctaLabel,
  ctaHref,
  variant,
  extra,
}: TrackCardProps) {
  return (
    <Link
      href={ctaHref}
      className={cn(
        'group relative flex flex-col rounded-2xl border-2 bg-card p-6 transition-all duration-300 sm:p-8',
        'hover:-translate-y-1 hover:shadow-xl',
        borderMap[variant],
      )}
    >
      {/* Accent gradient overlay */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-30 transition-opacity duration-300 group-hover:opacity-50',
          gradientMap[variant],
        )}
      />

      <div className="relative flex flex-1 flex-col">
        {/* Icon */}
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-300',
            iconBgMap[variant],
          )}
        >
          {icon}
        </div>

        {/* Title + subtitle */}
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {subtitle}
        </p>

        {/* Description */}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* Extra info (plan progress, etc.) */}
        {extra && <div className="mt-3">{extra}</div>}

        {/* CTA button */}
        <div className="mt-6 flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 group-hover:scale-105',
              ctaMap[variant],
            )}
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
