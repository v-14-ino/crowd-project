"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  FreshnessBadge,
  PriorityBadge,
  ConfidenceBadge,
  CategoryBadge,
  OpStateBadges,
} from "@/components/dashboard/badges";
import { ISSUE_TYPE_LABELS, type Incident } from "@/lib/types";
import { timeAgo } from "@/lib/api-client";
import { AlertCircle, ChevronRight, MapPin, Users, FileImage, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface IncidentQueueProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  onSelect: (incident: Incident) => void;
  selectedId?: string | null;
  compact?: boolean;
  selectedForCompare?: Incident[];
  onToggleCompare?: (incident: Incident) => void;
}

const rowAccent: Record<string, string> = {
  Critical: "cv-row-critical",
  High: "cv-row-high",
  Medium: "cv-row-medium",
  Low: "cv-row-low",
};

export function IncidentQueue({
  incidents,
  loading,
  error,
  onSelect,
  selectedId,
  compact,
  selectedForCompare,
  onToggleCompare,
}: IncidentQueueProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-300 bg-rose-50 p-6 text-center dark:bg-rose-950/40">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-600" />
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No incidents match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="cv-scroll max-h-[560px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-[34px]"></TableHead>
              {onToggleCompare && <TableHead className="w-[40px] text-center">Cmp</TableHead>}
              <TableHead className="min-w-[180px]">Incident</TableHead>
              <TableHead className="min-w-[120px]">Status</TableHead>
              <TableHead className="min-w-[120px]">Priority</TableHead>
              <TableHead className="min-w-[120px]">Confidence</TableHead>
              <TableHead className="min-w-[90px]">Fresh</TableHead>
              {!compact && <TableHead className="min-w-[100px]">Reports</TableHead>}
              {!compact && <TableHead className="min-w-[150px]">Location</TableHead>}
              <TableHead className="min-w-[110px]">Updated</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((inc, idx) => {
              const hasEvidence = (inc as any).hasEvidence;
              const hasResp = (inc as any).hasResponderVerification;
              return (
                <TableRow
                  key={inc.id}
                  onClick={() => onSelect(inc)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    rowAccent[inc.priorityLevel] || rowAccent.Low,
                    selectedId === inc.id && "bg-primary/5",
                    selectedForCompare?.some((s) => s.id === inc.id) && "bg-primary/10"
                  )}
                >
                  <TableCell className="py-2 text-center text-xs font-bold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  {onToggleCompare && (
                    <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleCompare(inc)}
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                          selectedForCompare?.some((s) => s.id === inc.id)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30 hover:border-primary/50"
                        )}
                        title="Toggle compare"
                      >
                        {selectedForCompare?.some((s) => s.id === inc.id) && (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-1">
                      <CategoryBadge category={inc.category} issueType={inc.issueType} />
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{inc.incidentId}</span>
                        {inc.zone && <span>· {inc.zone}</span>}
                      </div>
                      {hasEvidence !== undefined && (
                        <div className="flex items-center gap-2 text-[10px]">
                          {hasEvidence ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <FileImage className="h-3 w-3" /> evidence
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                              <FileImage className="h-3 w-3" /> no evidence
                            </span>
                          )}
                          {hasResp && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <Users className="h-3 w-3" /> responder
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2"><StatusBadge status={inc.status} /></TableCell>
                  <TableCell className="py-2">
                    <PriorityBadge level={inc.priorityLevel} score={inc.priorityScore} />
                  </TableCell>
                  <TableCell className="py-2">
                    <ConfidenceBadge level={inc.confidenceLevel} score={inc.confidenceScore} />
                  </TableCell>
                  <TableCell className="py-2"><FreshnessBadge freshness={inc.freshnessStatus} /></TableCell>
                  {!compact && (
                    <TableCell className="py-2 text-xs tabular-nums">
                      <span className="font-semibold">{inc.independentReportsCount}</span>
                      <span className="text-muted-foreground">/{inc.totalReportsCount}</span>
                      {inc.duplicateReportsCount > 0 && (
                        <div className="text-[10px] text-amber-600">
                          {inc.duplicateReportsCount} dup
                        </div>
                      )}
                    </TableCell>
                  )}
                  {!compact && (
                    <TableCell className="py-2 text-xs">
                      {inc.latitude != null && inc.longitude != null ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <MapPin className="h-3 w-3 text-emerald-600" />
                          {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-amber-600">missing</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {inc.lastReportedTime ? timeAgo(inc.lastReportedTime) : "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
