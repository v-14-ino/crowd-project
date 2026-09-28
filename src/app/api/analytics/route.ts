import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Aggregated analytics for charts: category distribution, status breakdown,
 * priority histogram, freshness distribution, zone heatmap, and trend over time.
 * Supports optional `days` query param to control the trend window (default 7).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysParam = parseInt(url.searchParams.get("days") || "7", 10);
  const days = Math.max(1, Math.min(90, isNaN(daysParam) ? 7 : daysParam));

  const incidents = await db.incident.findMany({
    include: { evidence: true, responderVerifications: true },
  });

  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const byFreshness: Record<string, number> = { Fresh: 0, Aging: 0, Stale: 0 };
  const byZone: Record<string, number> = {};
  const byConfidenceBucket: Record<string, number> = { High: 0, Medium: 0, Low: 0 };

  // Time trend: incidents created per day (last `days` days)
  const now = new Date();
  const trend: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    trend.push({
      date: d.toISOString().slice(0, 10),
      count: 0,
    });
  }

  for (const inc of incidents) {
    byCategory[inc.category] = (byCategory[inc.category] || 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
    if (byPriority[inc.priorityLevel] !== undefined) byPriority[inc.priorityLevel]++;
    if (byFreshness[inc.freshnessStatus] !== undefined) byFreshness[inc.freshnessStatus]++;
    if (inc.zone) byZone[inc.zone] = (byZone[inc.zone] || 0) + 1;
    if (byConfidenceBucket[inc.confidenceLevel] !== undefined)
      byConfidenceBucket[inc.confidenceLevel]++;

    // trend
    const day = inc.createdAt.toISOString().slice(0, 10);
    const entry = trend.find((t) => t.date === day);
    if (entry) entry.count++;
  }

  // Average confidence by category
  const avgConfByCategory: Record<string, { avg: number; count: number }> = {};
  for (const inc of incidents) {
    if (!avgConfByCategory[inc.category]) {
      avgConfByCategory[inc.category] = { avg: 0, count: 0 };
    }
    avgConfByCategory[inc.category].avg += inc.confidenceScore;
    avgConfByCategory[inc.category].count++;
  }
  Object.keys(avgConfByCategory).forEach((k) => {
    const v = avgConfByCategory[k];
    avgConfByCategory[k].avg = v.count > 0 ? Math.round(v.avg / v.count) : 0;
  });

  // Evidence coverage
  const withEvidence = incidents.filter((i) => i.evidence.length > 0).length;
  const withResponder = incidents.filter((i) => i.responderVerifications.length > 0).length;

  return NextResponse.json({
    byCategory,
    byStatus,
    byPriority,
    byFreshness,
    byZone,
    byConfidenceBucket,
    avgConfByCategory,
    trend,
    evidenceCoverage: {
      withEvidence,
      withoutEvidence: incidents.length - withEvidence,
      withResponder,
      withoutResponder: incidents.length - withResponder,
    },
    total: incidents.length,
  });
}
