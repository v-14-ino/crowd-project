"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ZAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncidentDetail } from "@/lib/types";
import { TrendingUp } from "lucide-react";
import { formatDateTime } from "@/lib/api-client";

interface Props {
  detail: IncidentDetail;
}

/**
 * Timeline scatter chart showing report submissions, evidence observations,
 * and responder verifications over time. Helps officers see the corroboration
 * pattern (e.g. 3 reports within 5 minutes = strong corroboration).
 */
export function IncidentTimeline({ detail }: Props) {
  // Build events list
  const events: Array<{
    time: number;
    type: "report" | "evidence" | "verification";
    label: string;
  }> = [];

  for (const r of detail.reports) {
    if (r.reportedTime) {
      events.push({
        time: new Date(r.reportedTime).getTime(),
        type: "report",
        label: `Report by ${r.citizenName || "anonymous"} (${r.citizenSeverity})`,
      });
    }
  }
  for (const e of detail.evidence) {
    if (e.observedAt) {
      events.push({
        time: new Date(e.observedAt).getTime(),
        type: "evidence",
        label: `Evidence: ${e.sourceType}`,
      });
    }
  }
  for (const v of detail.responderVerifications) {
    events.push({
      time: new Date(v.verifiedAt).getTime(),
      type: "verification",
      label: `${v.responderName}: ${v.verificationStatus}`,
    });
  }

  events.sort((a, b) => a.time - b.time);

  if (events.length === 0) {
    return null;
  }

  const minTime = events[0].time;
  const maxTime = events[events.length - 1].time;
  const span = Math.max(maxTime - minTime, 60 * 1000); // min 1 min span

  // Normalize times to 0-100 for X axis
  const data = events.map((e, i) => ({
    x: ((e.time - minTime) / span) * 100,
    y: e.type === "report" ? 3 : e.type === "evidence" ? 2 : 1,
    label: e.label,
    time: formatDateTime(e.time),
    index: i + 1,
    type: e.type,
  }));

  const typeColors: Record<string, string> = {
    report: "#0d9488",
    evidence: "#7c3aed",
    verification: "#dc2626",
  };

  const typeLabels: Record<string, string> = {
    report: "Citizen report",
    evidence: "Evidence",
    verification: "Responder",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Corroboration Timeline
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Events over time — tight clustering of reports indicates strong corroboration.
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              tick={{ fontSize: 9 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v) => {
                const mins = Math.round((v / 100) * (span / 60000));
                return `${mins}m`;
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 4]}
              ticks={[1, 2, 3]}
              tick={{ fontSize: 9 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v) =>
                v === 3 ? "Reports" : v === 2 ? "Evidence" : v === 1 ? "Responder" : ""
              }
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as any;
                return (
                  <div className="rounded-md border bg-card p-2 text-[10px] shadow-sm">
                    <p className="font-semibold">{d.label}</p>
                    <p className="text-muted-foreground">{d.time}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={3} stroke="#0d9488" strokeDasharray="2 2" strokeOpacity={0.2} />
            <ReferenceLine y={2} stroke="#7c3aed" strokeDasharray="2 2" strokeOpacity={0.2} />
            <ReferenceLine y={1} stroke="#dc2626" strokeDasharray="2 2" strokeOpacity={0.2} />
            {Object.keys(typeColors).map((type) => (
              <Scatter
                key={type}
                data={data.filter((d) => d.type === type)}
                fill={typeColors[type]}
                name={typeLabels[type]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {Object.entries(typeLabels).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: typeColors[type] }}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
