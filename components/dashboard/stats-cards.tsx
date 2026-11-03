'use client';

interface EstimatedCompletion {
  daysRemaining: number;
  date: string;
}

interface StatsCardsProps {
  streak: number;
  remaining: number;
  estimatedCompletion: EstimatedCompletion;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${parseInt(month!, 10)}月${parseInt(day!, 10)}日`;
}

export function StatsCards({
  streak,
  remaining,
  estimatedCompletion,
}: StatsCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Streak */}
      <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xs text-muted-foreground">连续打卡</p>
            <p className="text-2xl font-bold tabular-nums">{streak}</p>
            <p className="text-xs text-muted-foreground">天</p>
          </div>
        </div>
      </div>

      {/* Estimated completion */}
      <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📅</span>
          <div>
            <p className="text-xs text-muted-foreground">预计完成</p>
            <p className="text-lg font-bold tabular-nums">
              {estimatedCompletion.daysRemaining > 0
                ? formatDate(estimatedCompletion.date)
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {estimatedCompletion.daysRemaining > 0
                ? `${estimatedCompletion.daysRemaining} 天后`
                : '暂无预估'}
            </p>
          </div>
        </div>
      </div>

      {/* Remaining problems */}
      <div className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-xs text-muted-foreground">待完成</p>
            <p className="text-2xl font-bold tabular-nums">{remaining}</p>
            <p className="text-xs text-muted-foreground">题</p>
          </div>
        </div>
      </div>
    </div>
  );
}
