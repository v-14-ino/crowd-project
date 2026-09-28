"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricsSkeleton } from "@/components/dashboard/skeletons";
import {
  CheckCircle2,
  XCircle,
  Target,
  TrendingUp,
  Gauge,
  Clock,
  FileBarChart,
  Sparkles,
  Database,
  PlayCircle,
  RefreshCw,
} from "lucide-react";

interface Metrics {
  summary: {
    totalReports: number;
    totalIncidents: number;
    verifiedIncidents: number;
    incorrectlyVerifiedReports: number;
    falsePositives: number;
    falseNegatives: number;
    highPriorityDetectionRate: number;
    verificationAccuracy: number;
    medianVerificationTimeSec: number;
    freshnessClassificationAccuracy: number;
    confidenceCalibration: Array<{ bucket: string; count: number; actualHighPct: number }>;
  };
  baseline: { p10: number; p20: number; recall: number; meanRank: number; medianRank: number };
  proposed: { p10: number; p20: number; recall: number; meanRank: number; medianRank: number; totalLatencyMs: number; avgLatencyMs: number; explainabilityPct: number };
  targets: { p10: number; p20: number; recall: number; latencyMs: number; explainability: number };
  targetMet: Record<string, boolean>;
  perIncident: Array<{
    rank: number;
    incidentId: string;
    label: string;
    zone: string;
    groundTruthVerified: boolean;
    groundTruthCategory: string;
    baselineScore: number;
    proposedScore: number;
    confidenceScore: number;
    status: string;
    freshness: string;
    operationalStates: string[];
  }>;
  errorAnalysis: {
    falsePositives: Array<{ incidentId: string; category: string; status: string; confidence: number }>;
    falseNegatives: Array<{ incidentId: string; status: string; confidence: number }>;
  };
}

export function MetricsPanel({ onSeed }: { onSeed?: () => void }) {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    api<Metrics>("/api/metrics")
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let active = true;
    api<Metrics>("/api/metrics")
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retryCount]);

  // Auto-retry once on transient fetch errors (e.g. dev server restarted)
  useEffect(() => {
    if (error && retryCount < 2) {
      const t = setTimeout(() => setRetryCount((c) => c + 1), 1500);
      return () => clearTimeout(t);
    }
  }, [error, retryCount]);

  if (loading) {
    return <MetricsSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-rose-600">
            {error || "Unable to load metrics"}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button onClick={() => setRetryCount((c) => c + 1)} variant="default" size="sm">
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Retry
            </Button>
            {onSeed && (
              <Button onClick={onSeed} variant="outline" size="sm">
                <Database className="mr-1 h-4 w-4" /> Seed experiment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    {
      metric: "Precision @10",
      target: `≥ ${data.targets.p10}%`,
      baseline: `${(data.baseline.p10 * 100).toFixed(1)}%`,
      proposed: `${(data.proposed.p10 * 100).toFixed(1)}%`,
      met: data.targetMet.p10,
    },
    {
      metric: "Precision @20",
      target: `≥ ${data.targets.p20}%`,
      baseline: `${(data.baseline.p20 * 100).toFixed(1)}%`,
      proposed: `${(data.proposed.p20 * 100).toFixed(1)}%`,
      met: data.targetMet.p20,
    },
    {
      metric: "High-Priority Recall",
      target: `≥ ${data.targets.recall}%`,
      baseline: `${(data.baseline.recall * 100).toFixed(1)}%`,
      proposed: `${(data.proposed.recall * 100).toFixed(1)}%`,
      met: data.targetMet.recall,
    },
    {
      metric: "Ranking Quality (mean rank)",
      target: "lower is better",
      baseline: data.baseline.meanRank.toFixed(1),
      proposed: data.proposed.meanRank.toFixed(1),
      met: data.proposed.meanRank < data.baseline.meanRank,
    },
    {
      metric: "Ranking Quality (median rank)",
      target: "lower is better",
      baseline: data.baseline.medianRank.toFixed(1),
      proposed: data.proposed.medianRank.toFixed(1),
      met: data.proposed.medianRank < data.baseline.medianRank,
    },
    {
      metric: "Time to surface (total)",
      target: `≤ ${(data.targets.latencyMs / 1000).toFixed(1)}s`,
      baseline: "N/A",
      proposed: `${(data.proposed.totalLatencyMs / 1000).toFixed(4)}s`,
      met: data.targetMet.latency,
    },
    {
      metric: "Explainability coverage",
      target: "100%",
      baseline: "N/A",
      proposed: `${data.proposed.explainabilityPct.toFixed(0)}%`,
      met: data.targetMet.explainability,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Baseline -> Target -> Measured */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Baseline → Target → Measured Result
          </CardTitle>
          <CardDescription>
            Comparison between the severity+recency baseline and the verification-engine
            prototype, against pre-defined targets. Ground truth is sourced from the
            reproducible simulated experiment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Prototype</TableHead>
                <TableHead>Target met?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.metric}>
                  <TableCell className="font-medium">{r.metric}</TableCell>
                  <TableCell className="text-xs">{r.target}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.baseline}</TableCell>
                  <TableCell className="text-xs font-semibold tabular-nums">{r.proposed}</TableCell>
                  <TableCell>
                    {r.met ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<FileBarChart className="h-4 w-4" />} label="Total reports" value={data.summary.totalReports} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Verified" value={data.summary.verifiedIncidents} accent="text-emerald-600" />
        <StatCard icon={<XCircle className="h-4 w-4" />} label="False positives" value={data.summary.falsePositives} accent="text-rose-600" />
        <StatCard icon={<XCircle className="h-4 w-4" />} label="False negatives" value={data.summary.falseNegatives} accent="text-rose-600" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="High-pri detection" value={`${data.summary.highPriorityDetectionRate.toFixed(0)}%`} />
        <StatCard icon={<Gauge className="h-4 w-4" />} label="Verification accuracy" value={`${data.summary.verificationAccuracy.toFixed(0)}%`} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Median verify time (sim)" value={data.summary.medianVerificationTimeSec > 0 ? `${(data.summary.medianVerificationTimeSec / 60).toFixed(1)} min` : "—"} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Freshness accuracy" value={`${data.summary.freshnessClassificationAccuracy.toFixed(0)}%`} />
        <StatCard icon={<Database className="h-4 w-4" />} label="Total incidents" value={data.summary.totalIncidents} />
      </div>

      {/* Confidence calibration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Confidence Calibration</CardTitle>
          <CardDescription className="text-xs">
            For each confidence bucket, what % were actually high-priority incidents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {data.summary.confidenceCalibration.map((c) => (
              <div key={c.bucket} className="rounded-md border p-3 text-center">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{c.bucket}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{c.actualHighPct.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{c.count} incidents</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-incident ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Per-Incident Ranking (Prototype)</CardTitle>
          <CardDescription className="text-xs">
            How the verification engine ranked each incident vs ground truth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="cv-scroll max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>GT</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Prototype</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perIncident.map((r) => (
                  <TableRow key={r.incidentId}>
                    <TableCell className="font-bold tabular-nums">{r.rank}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.incidentId}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.zone}</TableCell>
                    <TableCell>
                      {r.groundTruthVerified ? (
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800 text-[10px]">HIGH</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{r.groundTruthCategory}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{r.baselineScore}</TableCell>
                    <TableCell className="text-xs font-semibold tabular-nums">{r.proposedScore}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Error analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Error Analysis</CardTitle>
          <CardDescription className="text-xs">
            Where did the prototype fail? False positives = non-high incidents not rejected.
            False negatives = true-high incidents ranked below the priority threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-rose-700">False Positives</p>
              {data.errorAnalysis.falsePositives.length === 0 ? (
                <p className="text-xs text-muted-foreground">None detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.errorAnalysis.falsePositives.map((f, i) => (
                    <div key={i} className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs dark:bg-rose-950/30">
                      <span className="font-mono text-[10px]">{f.incidentId}</span> ·{" "}
                      <span className="font-medium">{f.category}</span> · status {f.status} · conf {f.confidence}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-amber-700">False Negatives</p>
              {data.errorAnalysis.falseNegatives.length === 0 ? (
                <p className="text-xs text-muted-foreground">None detected.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.errorAnalysis.falseNegatives.map((f, i) => (
                    <div key={i} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:bg-amber-950/30">
                      <span className="font-mono text-[10px]">{f.incidentId}</span> · status {f.status} · conf {f.confidence}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <PlayCircle className="mr-1 h-3.5 w-3.5" /> Re-run evaluation
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Card className="p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </Card>
  );
}
