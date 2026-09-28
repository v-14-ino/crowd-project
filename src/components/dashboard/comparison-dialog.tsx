"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import {
  StatusBadge,
  FreshnessBadge,
  PriorityBadge,
  ConfidenceBadge,
  CategoryBadge,
  ConfidenceBar,
  PriorityBar,
} from "@/components/dashboard/badges";
import { ISSUE_TYPE_LABELS, type Incident } from "@/lib/types";
import { timeAgo } from "@/lib/api-client";
import { GitCompare, X, ShieldCheck } from "lucide-react";

interface ComparisonItem {
  incidentId: string;
  incident?: Incident;
  evaluation?: {
    confidenceScore: number;
    confidenceLevel: string;
    confidenceBreakdown: Array<{
      label: string;
      delta: number;
      detail: string;
      kind: string;
    }>;
    confidenceHumanSummary: string;
    priorityScore: number;
    priorityLevel: string;
    freshness: string;
    status: string;
    operationalStates: string[];
    recommendedAction: string;
    independentReports: number;
    duplicateReports: number;
  };
  evidenceCount: number;
  verificationCount: number;
  notFound?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidents: Incident[]; // selected incidents to compare
}

export function ComparisonDialog({ open, onOpenChange, incidents }: Props) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || incidents.length < 2) return;
    let active = true;
    const ids = incidents.map((i) => i.incidentId).join(",");
    api<{ comparisons: ComparisonItem[] }>(`/api/incidents/compare?ids=${ids}`)
      .then((d) => {
        if (active) {
          setItems(d.comparisons);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, incidents]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cv-scroll max-h-[90vh] overflow-y-auto sm:max-w-4xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Compare {incidents.length} Incidents
          </DialogTitle>
          <DialogDescription>
            Side-by-side comparison of confidence breakdown, priority, and
            verification status to help prioritise field response.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {incidents.map((_, i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          >
            {items.map((item) => (
              <div key={item.incidentId} className="rounded-lg border bg-card p-3 shadow-sm">
                {item.notFound ? (
                  <p className="text-xs text-rose-600">{item.incidentId} not found</p>
                ) : (
                  <>
                    {/* Header */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <CategoryBadge
                        category={item.incident!.category}
                        issueType={item.incident!.issueType}
                      />
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        title="Incident ID"
                      >
                        <span className="font-mono text-[9px]">{item.incidentId}</span>
                      </button>
                    </div>
                    <p className="mb-2 text-[10px] text-muted-foreground">
                      {item.incident!.zone} · {timeAgo(item.incident!.lastReportedTime || item.incident!.createdAt)}
                    </p>

                    {/* Scores */}
                    <div className="mb-2 space-y-1.5">
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Confidence</p>
                        <ConfidenceBar
                          score={item.evaluation!.confidenceScore}
                          level={item.evaluation!.confidenceLevel}
                        />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Priority</p>
                        <PriorityBar
                          score={item.evaluation!.priorityScore}
                          level={item.evaluation!.priorityLevel}
                        />
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="mb-2 flex flex-wrap gap-1">
                      <StatusBadge status={item.evaluation!.status} />
                      <FreshnessBadge freshness={item.evaluation!.freshness} />
                    </div>

                    {/* Breakdown */}
                    <div className="mb-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                        Confidence breakdown
                      </p>
                      <div className="space-y-1">
                        {item.evaluation!.confidenceBreakdown.map((b, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="truncate">
                              <span
                                className={
                                  b.kind === "bonus"
                                    ? "text-emerald-600"
                                    : b.kind === "penalty"
                                    ? "text-rose-600"
                                    : b.kind === "override"
                                    ? "text-violet-600"
                                    : "text-muted-foreground"
                                }
                              >
                                {b.delta > 0 ? `+${b.delta}` : b.delta === 0 ? "0" : `${b.delta}`}
                              </span>{" "}
                              {b.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="mb-2 grid grid-cols-2 gap-1 text-[10px]">
                      <Stat label="Independent" value={item.evaluation!.independentReports} />
                      <Stat label="Duplicates" value={item.evaluation!.duplicateReports} />
                      <Stat label="Evidence" value={item.evidenceCount} />
                      <Stat label="Verifications" value={item.verificationCount} />
                    </div>

                    {/* Recommended action */}
                    <div className="rounded-md bg-primary/5 p-1.5">
                      <p className="text-[9px] leading-tight text-foreground">
                        <span className="font-semibold">Action: </span>
                        {item.evaluation!.recommendedAction}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/30 px-1.5 py-0.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
