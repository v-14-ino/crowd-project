"use client";

import { Badge } from "@/components/ui/badge";
import { ISSUE_TYPE_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  Verified: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
  Corroborated: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300",
  Pending: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  Conflicted: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
  Rejected: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300",
  Unknown: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300",
};

const FRESHNESS_STYLES: Record<string, string> = {
  Fresh: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
  Aging: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  Stale: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
  Unknown: "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300",
};

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300",
  High: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300",
  Medium: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
  Medium: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
};

const CATEGORY_STYLES: Record<string, string> = {
  Roads: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300",
  "Street Lighting": "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300",
  Waste: "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-950 dark:text-lime-300",
};

const OP_STATE_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-600 text-white",
  HIGH_PRIORITY: "bg-red-600 text-white",
  PRIORITIZE: "bg-orange-600 text-white",
  PENDING_VERIFICATION: "bg-amber-500 text-white",
  STALE: "bg-rose-500 text-white",
  AGING: "bg-amber-400 text-white",
  FRESH: "bg-emerald-500 text-white",
  MISSING_LOCATION: "bg-amber-600 text-white",
  MISSING_EVIDENCE: "bg-orange-500 text-white",
  CONFLICTING_EVIDENCE: "bg-rose-600 text-white",
  INSUFFICIENT_DATA: "bg-zinc-500 text-white",
  REJECTED: "bg-zinc-700 text-white",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`${STATUS_STYLES[status] || STATUS_STYLES.Unknown} font-medium`}>
      {status}
    </Badge>
  );
}

export function FreshnessBadge({ freshness }: { freshness: string }) {
  return (
    <Badge variant="outline" className={`${FRESHNESS_STYLES[freshness] || FRESHNESS_STYLES.Unknown} font-medium`}>
      {freshness}
    </Badge>
  );
}

export function PriorityBadge({ level, score }: { level: string; score?: number }) {
  return (
    <Badge variant="outline" className={`${PRIORITY_STYLES[level] || PRIORITY_STYLES.Low} font-medium`}>
      {level}{score != null ? ` · ${score}` : ""}
    </Badge>
  );
}

export function ConfidenceBadge({ level, score }: { level: string; score?: number }) {
  return (
    <Badge variant="outline" className={`${CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.Low} font-medium`}>
      {level}{score != null ? ` · ${score}` : ""}
    </Badge>
  );
}

export function CategoryBadge({ category, issueType }: { category: string; issueType?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className={`${CATEGORY_STYLES[category] || "bg-zinc-100 text-zinc-700 border-zinc-300"} font-medium`}>
        {category}
      </Badge>
      {issueType && (
        <span className="text-xs text-muted-foreground">
          {ISSUE_TYPE_LABELS[issueType] || issueType}
        </span>
      )}
    </span>
  );
}

export function OpStateBadges({ states }: { states: string[] }) {
  if (!states || states.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {states.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${OP_STATE_STYLES[s] || "bg-zinc-500 text-white"}`}
        >
          {s.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

export function ConfidenceBar({ score, level }: { score: number; level: string }) {
  const color =
    level === "High" ? "bg-emerald-500" : level === "Medium" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`cv-bar-fill absolute left-0 top-0 h-full rounded-full ${color}`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="min-w-[2.5rem] text-right text-xs font-semibold tabular-nums">
        {score}/100
      </span>
    </div>
  );
}

export function PriorityBar({ score, level }: { score: number; level: string }) {
  const color =
    level === "Critical"
      ? "bg-red-500"
      : level === "High"
      ? "bg-orange-500"
      : level === "Medium"
      ? "bg-amber-500"
      : "bg-zinc-400";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`cv-bar-fill absolute left-0 top-0 h-full rounded-full ${color}`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="min-w-[2.5rem] text-right text-xs font-semibold tabular-nums">
        {score}/100
      </span>
    </div>
  );
}
