'use client';

import { cn } from '@/lib/utils';
import { TOPIC_NAMES } from '@/lib/constants/topics';

interface TopicData {
  solved: number;
  total: number;
  avgMastery: number;
}

interface TopicHeatmapProps {
  topicHeatmap: Record<string, TopicData>;
}

function getMasteryColor(avgMastery: number): string {
  if (avgMastery >= 2.5) return 'bg-green-500';
  if (avgMastery >= 1.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function getMasteryLabel(avgMastery: number): string {
  if (avgMastery >= 2.5) return '熟练';
  if (avgMastery >= 1.5) return '一般';
  return '薄弱';
}

function getTopicName(key: string): string {
  return TOPIC_NAMES[key] ?? key;
}

export function TopicHeatmap({ topicHeatmap }: TopicHeatmapProps) {
  const entries = Object.entries(topicHeatmap);
  const sorted = entries.sort(
    ([, a], [, b]) => b.avgMastery - a.avgMastery,
  );

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        暂无题目数据
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map(([topic, data]) => {
        const pct = data.total > 0 ? Math.round((data.solved / data.total) * 100) : 0;
        const masteryColor = getMasteryColor(data.avgMastery);
        const masteryLabel = getMasteryLabel(data.avgMastery);

        return (
          <div key={topic} className="flex items-center gap-3">
            {/* Topic name */}
            <span className="w-20 flex-shrink-0 text-sm font-medium">
              {getTopicName(topic)}
            </span>

            {/* Progress bar */}
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground mix-blend-difference invert">
                {data.solved}/{data.total}
              </span>
            </div>

            {/* Mastery badge */}
            <span
              className={cn(
                'inline-flex w-14 flex-shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium text-white',
                masteryColor,
              )}
            >
              {masteryLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
