'use client';

import { useMemo } from 'react';

import { TOPIC_NAMES } from '@/lib/constants/topics';

interface TopicProgress {
  solved: number;
  total: number;
}

interface TopicBreakdownProps {
  topics: string[];
  topicData: Record<string, TopicProgress>;
}

function getTopicName(key: string): string {
  return TOPIC_NAMES[key] ?? key;
}

export function TopicBreakdown({ topics, topicData }: TopicBreakdownProps) {
  const sorted = useMemo(() => {
    return [...topics].sort((a, b) => {
      const solvedA = topicData[a]?.solved ?? 0;
      const totalA = topicData[a]?.total ?? 1;
      const solvedB = topicData[b]?.solved ?? 0;
      const totalB = topicData[b]?.total ?? 1;
      const pctA = solvedA / totalA;
      const pctB = solvedB / totalB;
      return pctB - pctA;
    });
  }, [topics, topicData]);

  if (topics.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无板块数据
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      {sorted.map((topic) => {
        const data = topicData[topic];
        const solved = data?.solved ?? 0;
        const total = data?.total ?? 0;
        const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

        return (
          <div key={topic} className="flex items-center gap-3">
            {/* Label */}
            <span className="w-24 flex-shrink-0 truncate text-sm font-medium">
              {getTopicName(topic)}
            </span>

            {/* Progress bar */}
            <div className="flex-1">
              <div className="bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Count */}
            <span className="w-16 flex-shrink-0 text-right text-sm text-muted-foreground">
              {solved}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
