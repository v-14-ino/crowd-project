"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, timeAgo } from "@/lib/api-client";
import type { Incident, IncidentStats } from "@/lib/types";
import {
  Bell,
  Flame,
  CheckCheck,
  AlertTriangle,
} from "lucide-react";

interface Props {
  stats: IncidentStats | null;
  incidents: Incident[];
  onSelect: (inc: Incident) => void;
}

/**
 * Notification feed: tracks high-priority incidents the user hasn't seen yet.
 * Stores "last seen" timestamp in localStorage; any high/critical incident
 * reported after that is shown as a new notification with a red badge count.
 */
export function NotificationFeed({ stats, incidents, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    return Number(localStorage.getItem("cvd_notif_last_seen") || Date.now());
  });
  const prevHighCount = useRef<number | null>(null);

  // Mark all as seen when the popover opens
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const now = Date.now();
      setLastSeen(now);
      if (typeof window !== "undefined") {
        localStorage.setItem("cvd_notif_last_seen", String(now));
      }
    }
  }

  // New high-priority incidents = those with lastReportedTime after lastSeen
  const newHighPriority = incidents.filter(
    (i) =>
      (i.priorityLevel === "Critical" || i.priorityLevel === "High") &&
      i.lastReportedTime &&
      new Date(i.lastReportedTime).getTime() > lastSeen &&
      ["Verified", "Corroborated", "Pending"].includes(i.status)
  );

  const totalHighPriority = (stats?.criticalIncidents || 0) + (stats?.highPriorityIncidents || 0);

  // Sort by priority score desc, then by reported time desc
  const sortedNotifs = [...newHighPriority]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 20);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-7 w-7 p-0"
          title="High-priority notifications"
          aria-label="High-priority notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {sortedNotifs.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {sortedNotifs.length > 9 ? "9+" : sortedNotifs.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notifications</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {totalHighPriority} total high-pri
          </Badge>
        </div>
        <ScrollArea className="max-h-80">
          {sortedNotifs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <CheckCheck className="h-6 w-6 text-emerald-500" />
              <p className="text-xs text-muted-foreground">
                You're all caught up. No new high-priority incidents since your last visit.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {sortedNotifs.map((inc) => (
                <li key={inc.id}>
                  <button
                    onClick={() => {
                      onSelect(inc);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2 p-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
                      <Flame className="h-3 w-3 text-red-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">
                          {inc.category} · {inc.issueType}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-red-600">
                          P{inc.priorityScore}
                        </span>
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {inc.incidentId} · {inc.zone}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {inc.lastReportedTime ? `Reported ${timeAgo(inc.lastReportedTime)}` : ""}
                        {" · "}{inc.independentReportsCount} reports
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {sortedNotifs.length > 0 && (
          <div className="border-t p-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => handleOpenChange(true)}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all as seen
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
