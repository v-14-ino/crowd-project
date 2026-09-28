"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPinOff,
  ImageOff,
  ShieldCheck,
  FileWarning,
  Flame,
  Activity,
} from "lucide-react";
import type { IncidentStats } from "@/lib/types";

interface KpiCardsProps {
  stats: IncidentStats | null;
  activeFilter: Record<string, string>;
  onCardClick: (filterType: string, filterVal: string) => void;
}

interface Kpi {
  key: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  filterType: string;
  filterVal: string;
  accent: string;
  iconBg: string;
}

export function KpiCards({ stats, activeFilter, onCardClick }: KpiCardsProps) {
  const s = stats || {
    totalIncidents: 0,
    criticalIncidents: 0,
    highPriorityIncidents: 0,
    corroboratedIncidents: 0,
    verifiedIncidents: 0,
    pendingIncidents: 0,
    conflictedIncidents: 0,
    rejectedIncidents: 0,
    staleIncidents: 0,
    freshIncidents: 0,
    missingLocationIncidents: 0,
    missingEvidenceIncidents: 0,
  };

  const cards: Kpi[] = [
    {
      key: "total",
      label: "Total Incidents",
      value: s.totalIncidents,
      icon: <Activity className="h-4 w-4" />,
      filterType: "all",
      filterVal: "All",
      accent: "border-l-4 border-l-primary",
      iconBg: "bg-primary/10 text-primary",
    },
    {
      key: "critical",
      label: "Critical Priority",
      value: s.criticalIncidents,
      icon: <Flame className="h-4 w-4" />,
      filterType: "priorityLevel",
      filterVal: "Critical",
      accent: "border-l-4 border-l-red-500",
      iconBg: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    },
    {
      key: "high",
      label: "High Priority",
      value: s.highPriorityIncidents,
      icon: <AlertTriangle className="h-4 w-4" />,
      filterType: "priorityLevel",
      filterVal: "High",
      accent: "border-l-4 border-l-orange-500",
      iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    },
    {
      key: "verified",
      label: "Verified",
      value: s.verifiedIncidents,
      icon: <ShieldCheck className="h-4 w-4" />,
      filterType: "status",
      filterVal: "Verified",
      accent: "border-l-4 border-l-emerald-500",
      iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    {
      key: "corroborated",
      label: "Corroborated",
      value: s.corroboratedIncidents,
      icon: <CheckCircle2 className="h-4 w-4" />,
      filterType: "status",
      filterVal: "Corroborated",
      accent: "border-l-4 border-l-teal-500",
      iconBg: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    },
    {
      key: "pending",
      label: "Pending Verification",
      value: s.pendingIncidents,
      icon: <Clock className="h-4 w-4" />,
      filterType: "status",
      filterVal: "Pending",
      accent: "border-l-4 border-l-amber-500",
      iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    {
      key: "conflicted",
      label: "Conflicting Evidence",
      value: s.conflictedIncidents,
      icon: <FileWarning className="h-4 w-4" />,
      filterType: "status",
      filterVal: "Conflicted",
      accent: "border-l-4 border-l-rose-500",
      iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    },
    {
      key: "stale",
      label: "Stale Reports",
      value: s.staleIncidents,
      icon: <Clock className="h-4 w-4" />,
      filterType: "freshness",
      filterVal: "Stale",
      accent: "border-l-4 border-l-rose-400",
      iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    },
    {
      key: "missingLoc",
      label: "Missing Location",
      value: s.missingLocationIncidents,
      icon: <MapPinOff className="h-4 w-4" />,
      filterType: "all",
      filterVal: "All",
      accent: "border-l-4 border-l-amber-600",
      iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    {
      key: "missingEv",
      label: "Missing Evidence",
      value: s.missingEvidenceIncidents,
      icon: <ImageOff className="h-4 w-4" />,
      filterType: "all",
      filterVal: "All",
      accent: "border-l-4 border-l-orange-400",
      iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {cards.map((c) => {
        const isActive =
          activeFilter[c.filterType === "all" ? "status" : c.filterType] === c.filterVal;
        return (
          <button
            key={c.key}
            onClick={() => onCardClick(c.filterType, c.filterVal)}
            className={cn(
              "group text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              c.accent
            )}
            style={{
              background: "var(--card)",
              borderRadius: "calc(var(--radius))",
            }}
          >
            <Card className={cn("h-full p-3 shadow-sm transition-shadow group-hover:shadow-md", isActive && "ring-2 ring-primary/40")}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md transition-transform group-hover:scale-110",
                    c.iconBg
                  )}
                >
                  {c.icon}
                </span>
                <AnimatedCounter
                  value={c.value}
                  className="text-2xl font-bold tabular-nums"
                />
              </div>
              <p className="mt-2 text-xs font-medium leading-tight text-muted-foreground">
                {c.label}
              </p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
