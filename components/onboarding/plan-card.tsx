'use client';

import { cn } from '@/lib/utils';
import { BookOpen, Zap, Settings2 } from 'lucide-react';

interface Plan {
  id: number;
  name: string;
  totalProblems: number;
  description: string;
  topics?: string[];
}

interface PlanCardProps {
  plan: Plan;
  selected: boolean;
  onSelect: (id: number) => void;
}

const iconMap: Record<number, React.ReactNode> = {
  1: <BookOpen className="h-6 w-6" />,
  2: <Zap className="h-6 w-6" />,
  3: <Settings2 className="h-6 w-6" />,
};

const accentColors: Record<number, string> = {
  1: 'from-blue-500/10 via-blue-500/5 to-transparent',
  2: 'from-amber-500/10 via-amber-500/5 to-transparent',
  3: 'from-violet-500/10 via-violet-500/5 to-transparent',
};

const accentBorders: Record<number, string> = {
  1: 'border-blue-500/30 ring-blue-500/15',
  2: 'border-amber-500/30 ring-amber-500/15',
  3: 'border-violet-500/30 ring-violet-500/15',
};

export function PlanCard({ plan, selected, onSelect }: PlanCardProps) {
  return (
    <button
      onClick={() => onSelect(plan.id)}
      className={cn(
        'group relative w-full rounded-xl border-2 p-6 text-left transition-all duration-300',
        'hover:scale-[1.02] hover:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? `border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/5 ${accentBorders[plan.id]}`
          : 'border-border bg-card hover:border-muted-foreground/20 hover:bg-accent/30',
      )}
      aria-pressed={selected}
    >
      {/* Accent gradient */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity duration-300',
          accentColors[plan.id],
          selected && 'opacity-100',
        )}
      />

      <div className="relative">
        {/* Icon + Problem count */}
        <div className="mb-4 flex items-center justify-between">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg transition-colors duration-300',
              selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground group-hover:text-foreground',
            )}
          >
            {iconMap[plan.id] || <BookOpen className="h-6 w-6" />}
          </div>
          {plan.totalProblems > 0 && (
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-300',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/10',
              )}
            >
              {plan.totalProblems} 题
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn(
            'text-lg font-bold tracking-tight transition-colors duration-300',
            selected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground',
          )}
        >
          {plan.name}
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

        {/* Selected checkmark */}
        {selected && (
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
