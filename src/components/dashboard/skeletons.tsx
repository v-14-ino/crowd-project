"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero skeleton */}
      <div className="cv-hero-gradient rounded-xl border p-4">
        <div className="mb-3 flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-3 w-96" />
          </div>
          <Skeleton className="h-6 w-48 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* High-priority queue skeleton */}
      <Skeleton className="h-28 w-full rounded-lg" />
      {/* Recent reports skeleton */}
      <Skeleton className="h-24 w-full rounded-lg" />
      {/* Filters skeleton */}
      <Skeleton className="h-20 w-full rounded-lg" />
      {/* Table + map skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-96 w-full rounded-lg lg:col-span-3" />
        <Skeleton className="h-96 w-full rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-72 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
