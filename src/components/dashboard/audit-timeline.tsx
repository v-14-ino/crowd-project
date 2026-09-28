"use client";

import { useEffect, useState } from "react";
import { api, timeAgo, formatDateTime } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  FileImage,
  ShieldCheck,
  RefreshCw,
  Database,
  History,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  actorRole: string | null;
  createdAt: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  report_submitted: <Send className="h-3.5 w-3.5" />,
  evidence_attached: <FileImage className="h-3.5 w-3.5" />,
  responder_verified: <ShieldCheck className="h-3.5 w-3.5" />,
  status_changed: <RefreshCw className="h-3.5 w-3.5" />,
  seed_run: <Database className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  report_submitted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  evidence_attached: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  responder_verified: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  status_changed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  seed_run: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function AuditTimeline({ incidentId }: { incidentId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<AuditEntry[]>(`/api/incidents/${incidentId}/audit`)
      .then((d) => {
        if (active) {
          setLogs(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLogs([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [incidentId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No audit events recorded yet for this incident.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      <ol className="space-y-3">
        {logs.map((log, idx) => {
          const icon = ACTION_ICONS[log.action] || <History className="h-3.5 w-3.5" />;
          const colorClass = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground";
          return (
            <li key={log.id} className="relative flex gap-3 pl-1">
              <div
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-card ${colorClass}`}
              >
                {icon}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold capitalize">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(log.createdAt)}
                  </span>
                </div>
                {log.details && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{log.details}</p>
                )}
                <p className="mt-0.5 text-[9px] text-muted-foreground/70">
                  {formatDateTime(log.createdAt)}
                  {log.actorRole ? ` · ${log.actorRole}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
