import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Export incidents as CSV for offline analysis / reporting.
 */
export async function GET() {
  const incidents = await db.incident.findMany({
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
  });

  const headers = [
    "incident_id",
    "category",
    "issue_type",
    "zone",
    "status",
    "human_status",
    "priority_score",
    "priority_level",
    "confidence_score",
    "confidence_level",
    "freshness",
    "total_reports",
    "independent_reports",
    "duplicate_reports",
    "latitude",
    "longitude",
    "last_reported_time",
    "created_at",
    "updated_at",
  ];

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = incidents.map((i) =>
    [
      i.incidentId,
      i.category,
      i.issueType,
      i.zone,
      i.status,
      i.humanStatus,
      i.priorityScore,
      i.priorityLevel,
      i.confidenceScore,
      i.confidenceLevel,
      i.freshnessStatus,
      i.totalReportsCount,
      i.independentReportsCount,
      i.duplicateReportsCount,
      i.latitude ?? "",
      i.longitude ?? "",
      i.lastReportedTime?.toISOString() ?? "",
      i.createdAt.toISOString(),
      i.updatedAt.toISOString(),
    ]
      .map(escape)
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="incidents-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
