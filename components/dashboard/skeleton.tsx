'use client';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-muted/60 ${className ?? ''}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-64" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      {/* Progress ring skeleton */}
      <div className="rounded-xl border bg-card p-6">
        <SkeletonBlock className="mx-auto h-40 w-40 rounded-full" />
        <SkeletonBlock className="mx-auto mt-3 h-4 w-32" />
      </div>

      {/* Topic heatmap skeleton */}
      <div className="rounded-xl border bg-card p-6">
        <SkeletonBlock className="mb-4 h-6 w-32" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-5 w-20" />
              <SkeletonBlock className="h-5 flex-1" />
              <SkeletonBlock className="h-5 w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Calendar skeleton */}
      <div className="rounded-xl border bg-card p-6">
        <SkeletonBlock className="mb-4 h-6 w-32" />
        <SkeletonBlock className="h-32 w-full" />
      </div>
    </div>
  );
}
