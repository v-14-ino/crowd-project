"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Incident } from "@/lib/types";
import { MapPin, AlertTriangle } from "lucide-react";

interface IncidentMapProps {
  incidents: Incident[];
  loading?: boolean;
  onSelect?: (inc: Incident) => void;
}

// Municipal bounding box (Delhi region used in seed data)
const BBOX = { minLat: 28.55, maxLat: 28.68, minLon: 77.16, maxLon: 77.30 };

const PRIORITY_COLOR: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#71717a",
};

const STATUS_FILL: Record<string, string> = {
  Verified: "#10b981",
  Corroborated: "#14b8a6",
  Pending: "#f59e0b",
  Conflicted: "#e11d48",
  Rejected: "#9f1239",
  Unknown: "#71717a",
};

export function IncidentMap({ incidents, loading, onSelect }: IncidentMapProps) {
  const points = useMemo(() => {
    return incidents
      .filter((i) => i.latitude != null && i.longitude != null)
      .map((i) => {
        const x =
          ((i.longitude! - BBOX.minLon) / (BBOX.maxLon - BBOX.minLon)) * 100;
        const y =
          (1 - (i.latitude! - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * 100;
        return { incident: i, x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
      });
  }, [incidents]);

  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" />
          Spatial Incident Map
        </div>
        <span className="text-xs text-muted-foreground">{points.length} located incidents</span>
      </div>
      <div className="relative aspect-square w-full bg-gradient-to-br from-emerald-50/50 to-amber-50/30 sm:aspect-[4/3]">
        {/* Grid lines */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {[20, 40, 60, 80].map((g) => (
            <g key={g}>
              <line x1={g} y1="0" x2={g} y2="100" stroke="currentColor" strokeWidth="0.2" className="text-muted-foreground/30" />
              <line x1="0" y1={g} x2="100" y2={g} stroke="currentColor" strokeWidth="0.2" className="text-muted-foreground/30" />
            </g>
          ))}
          {/* Zone labels */}
          <text x="22" y="22" fontSize="2.4" className="fill-muted-foreground/60 font-sans">North</text>
          <text x="22" y="82" fontSize="2.4" className="fill-muted-foreground/60 font-sans">South</text>
          <text x="70" y="22" fontSize="2.4" className="fill-muted-foreground/60 font-sans">East</text>
          <text x="70" y="82" fontSize="2.4" className="fill-muted-foreground/60 font-sans">West</text>
          <text x="45" y="52" fontSize="2.4" className="fill-muted-foreground/60 font-sans">Central</text>
          {/* Incident markers */}
          {points.map(({ incident, x, y }) => {
            const r = incident.priorityLevel === "Critical" ? 2.4 : incident.priorityLevel === "High" ? 2 : 1.5;
            const color = PRIORITY_COLOR[incident.priorityLevel] || PRIORITY_COLOR.Low;
            const fill = STATUS_FILL[incident.status] || STATUS_FILL.Unknown;
            return (
              <g
                key={incident.id}
                className="cursor-pointer"
                onClick={() => onSelect?.(incident)}
              >
                {incident.priorityLevel === "Critical" && (
                  <circle cx={x} cy={y} r={r + 1.5} fill={color} opacity="0.25">
                    <animate attributeName="r" values={`${r + 1};${r + 2.5};${r + 1}`} dur="1.6s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={x} cy={y} r={r} fill={fill} stroke={color} strokeWidth="0.6" />
              </g>
            );
          })}
          {points.length === 0 && (
            <text x="50" y="50" textAnchor="middle" fontSize="3" className="fill-muted-foreground">
              No located incidents
            </text>
          )}
        </svg>
        {/* Legend */}
        <div className="absolute bottom-2 left-2 rounded-md bg-card/95 px-2 py-1.5 text-[10px] shadow-sm backdrop-blur">
          <div className="mb-1 font-semibold">Priority</div>
          <div className="flex flex-col gap-0.5">
            {Object.entries(PRIORITY_COLOR).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: v }} />
                {k}
              </div>
            ))}
          </div>
        </div>
      </div>
      {incidents.some((i) => i.latitude == null) && (
        <div className="flex items-center gap-1.5 border-t bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-3 w-3" />
          {incidents.filter((i) => i.latitude == null).length} incident(s) have missing location and are not plotted.
        </div>
      )}
    </Card>
  );
}
