import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toIncidentType } from "@/lib/db-ops";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const priorityLevel = url.searchParams.get("priorityLevel");
  const confidenceLevel = url.searchParams.get("confidenceLevel");
  const freshness = url.searchParams.get("freshness");
  const zone = url.searchParams.get("zone");
  const issueType = url.searchParams.get("issueType");
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

  const where: any = {};
  if (category && category !== "All") where.category = category;
  if (status && status !== "All") where.status = status;
  if (priorityLevel && priorityLevel !== "All") where.priorityLevel = priorityLevel;
  if (confidenceLevel && confidenceLevel !== "All")
    where.confidenceLevel = confidenceLevel;
  if (freshness && freshness !== "All") where.freshnessStatus = freshness;
  if (zone && zone !== "All") where.zone = zone;
  if (issueType && issueType !== "All") where.issueType = issueType;
  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { incidentId: { contains: term } },
      { category: { contains: term } },
      { issueType: { contains: term } },
      { zone: { contains: term } },
    ];
  }

  const incidents = await db.incident.findMany({
    where,
    orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      incidentLinks: true,
      evidence: true,
      responderVerifications: true,
    },
  });

  const items = incidents.map((i) => ({
    ...toIncidentType(i),
    hasEvidence: i.evidence.length > 0,
    hasResponderVerification: i.responderVerifications.length > 0,
  }));
  return NextResponse.json(items);
}
