/**
 * Reproducible simulated experiment — the validation dataset.
 *
 * Mirrors the structure of backend/scripts/evaluate_system.py but uses
 * the explicit municipal categories (Roads / Street Lighting / Waste) and
 * contains every edge case required:
 *   - duplicate reports
 *   - fresh reports
 *   - stale reports
 *   - missing location
 *   - conflicting evidence
 *   - missing evidence / insufficient data
 *   - high-priority incidents
 *   - responder-rejected false alarms
 *
 * Each incident is tagged with a ground-truth label used by the metrics
 * dashboard to compute precision/recall.
 */

import { db } from "@/lib/db";
import { evaluateIncident, baselinePriorityScore } from "@/lib/verification-engine";
import {
  newReportId,
  newIncidentId,
  newEvidenceId,
  recomputeIncident,
} from "@/lib/db-ops";
import type { Report, ExternalEvidence, ResponderVerification } from "@/lib/types";

export interface SeedScenario {
  label: string; // human label
  groundTruthCategory: string; // normal | duplicate | stale | missing_location | conflicting_evidence | missing_evidence | responder_rejected | high_priority
  groundTruthVerified: boolean; // true = should be high priority, false = should not
  category: string;
  issueType: string;
  zone: string;
  baseLat: number;
  baseLon: number;
  reports: Array<{
    severity: string;
    description: string;
    citizenName: string;
    offsetMinutes: number; // reported time offset from "now" (negative = past)
    lat?: number; // overrides base if provided
    lon?: number;
    conflicting?: string;
    missingLocation?: boolean; // explicitly omit GPS for this report
  }>;
  evidence?: Array<{
    sourceType: string;
    sourceStatus: string;
    observedOffsetMinutes: number;
    details: string;
    corrupted?: boolean;
  }>;
  verifications?: Array<{
    responderName: string;
    status: "Verified" | "Rejected" | "Needs More Evidence";
    notes?: string;
    offsetMinutes: number;
  }>;
}

// Reference timestamp for the experiment. We anchor "now" to the actual run
// time so that freshness (Fresh / Aging / Stale) classifies correctly relative
// to the moment the dashboard is viewed. The offsets (negative minutes) make
// the experiment reproducible in structure across runs.
export const SEED_REFERENCE_TIME = new Date();

function mins(ms: number): Date {
  return new Date(SEED_REFERENCE_TIME.getTime() + ms * 60 * 1000);
}

export const SEED_SCENARIOS: SeedScenario[] = [
  // ---- TRUE HIGH-PRIORITY (ground truth: true) ----
  {
    label: "Pothole on Main Street — heavily corroborated with photo",
    groundTruthCategory: "high_priority",
    groundTruthVerified: true,
    category: "Roads",
    issueType: "pothole",
    zone: "Central Zone",
    baseLat: 28.6139,
    baseLon: 77.209,
    reports: [
      {
        severity: "Critical",
        description: "Large pothole damaging vehicles near the junction",
        citizenName: "Aarav Sharma",
        offsetMinutes: -30,
      },
      {
        severity: "High",
        description: "Hit the pothole, tyre burst",
        citizenName: "Priya Patel",
        offsetMinutes: -25,
      },
      {
        severity: "High",
        description: "Dangerous pothole, traffic slowing",
        citizenName: "Rohan Mehta",
        offsetMinutes: -20,
      },
    ],
    evidence: [
      {
        sourceType: "Citizen photo",
        sourceStatus: "High Quality",
        observedOffsetMinutes: -28,
        details: "Photo of pothole with ruler for scale",
      },
    ],
  },
  {
    label: "Streetlight not working in Old Town — verified by responder",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Street Lighting",
    issueType: "streetlight_not_working",
    zone: "Old Town",
    baseLat: 28.62,
    baseLon: 77.21,
    reports: [
      {
        severity: "High",
        description: "Whole street dark at night, safety risk",
        citizenName: "Meera Iyer",
        offsetMinutes: -120,
      },
      {
        severity: "Medium",
        description: "Streetlight out since 2 days",
        citizenName: "Vikram Singh",
        offsetMinutes: -110,
      },
    ],
    verifications: [
      {
        responderName: "Officer Desai",
        status: "Verified",
        notes: "Confirmed on patrol, maintenance scheduled",
        offsetMinutes: -60,
      },
    ],
  },
  {
    label: "Overflowing bin near market — fresh, corroborated",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Waste",
    issueType: "overflowing_bin",
    zone: "Central Zone",
    baseLat: 28.615,
    baseLon: 77.208,
    reports: [
      {
        severity: "High",
        description: "Bins overflowing, garbage on road",
        citizenName: "Sunita Rao",
        offsetMinutes: -40,
      },
      {
        severity: "High",
        description: "Smell and flies near market bins",
        citizenName: "Karan Joshi",
        offsetMinutes: -35,
      },
    ],
    evidence: [
      {
        sourceType: "CCTV",
        sourceStatus: "Verified",
        observedOffsetMinutes: -38,
        details: "Municipal CCTV confirms overflow",
      },
    ],
  },
  {
    label: "Road blockage — fallen tree, critical",
    groundTruthCategory: "high_priority",
    groundTruthVerified: true,
    category: "Roads",
    issueType: "road_blockage",
    zone: "North Zone",
    baseLat: 28.65,
    baseLon: 77.22,
    reports: [
      {
        severity: "Critical",
        description: "Tree fell blocking entire road",
        citizenName: "Anita Gupta",
        offsetMinutes: -15,
      },
      {
        severity: "Critical",
        description: "No vehicles can pass",
        citizenName: "Deepak Nair",
        offsetMinutes: -12,
      },
      {
        severity: "High",
        description: "Traffic diverted, long queue",
        citizenName: "Fatima Khan",
        offsetMinutes: -10,
      },
    ],
    evidence: [
      {
        sourceType: "Citizen photo",
        sourceStatus: "High Quality",
        observedOffsetMinutes: -14,
        details: "Photo of fallen tree",
      },
    ],
  },
  {
    label: "Damaged road — multiple zones corroborated",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Roads",
    issueType: "damaged_road",
    zone: "South Zone",
    baseLat: 28.58,
    baseLon: 77.19,
    reports: [
      {
        severity: "High",
        description: "Road surface crumbling near bus stop",
        citizenName: "Ramesh Yadav",
        offsetMinutes: -90,
      },
      {
        severity: "Medium",
        description: "Damaged road, two-wheeler riders at risk",
        citizenName: "Lakshmi Menon",
        offsetMinutes: -80,
      },
    ],
  },
  {
    label: "Dark area — streetlight damaged, corroborated",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Street Lighting",
    issueType: "dark_area",
    zone: "East Zone",
    baseLat: 28.63,
    baseLon: 77.24,
    reports: [
      {
        severity: "High",
        description: "Park area completely dark at night",
        citizenName: "Imran Sheikh",
        offsetMinutes: -180,
      },
      {
        severity: "Medium",
        description: "No lights in children park",
        citizenName: "Geeta Verma",
        offsetMinutes: -170,
      },
    ],
    evidence: [
      {
        sourceType: "Sensor",
        sourceStatus: "Standard",
        observedOffsetMinutes: -175,
        details: "Light sensor reading 0 lux",
      },
    ],
  },
  {
    label: "Garbage accumulation — illegal dumping fresh",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Waste",
    issueType: "garbage_accumulation",
    zone: "Industrial Park",
    baseLat: 28.59,
    baseLon: 77.26,
    reports: [
      {
        severity: "High",
        description: "Construction waste dumped illegally",
        citizenName: "Suresh Pillai",
        offsetMinutes: -50,
      },
      {
        severity: "High",
        description: "Huge pile of debris near factory",
        citizenName: "Nisha Agarwal",
        offsetMinutes: -45,
      },
    ],
  },
  {
    label: "Damaged light — high severity corroborated",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Street Lighting",
    issueType: "damaged_light",
    zone: "West Zone",
    baseLat: 28.61,
    baseLon: 77.18,
    reports: [
      {
        severity: "High",
        description: "Light pole bent, wires exposed",
        citizenName: "Arjun Reddy",
        offsetMinutes: -60,
      },
      {
        severity: "Medium",
        description: "Damaged light, dangerous wires",
        citizenName: "Pooja Bhat",
        offsetMinutes: -55,
      },
    ],
  },
  {
    label: "Overflowing bin — harbor district",
    groundTruthCategory: "normal",
    groundTruthVerified: true,
    category: "Waste",
    issueType: "overflowing_bin",
    zone: "Harbor District",
    baseLat: 28.6,
    baseLon: 77.27,
    reports: [
      {
        severity: "Medium",
        description: "Bins full, not collected",
        citizenName: "Mohit Sinha",
        offsetMinutes: -100,
      },
      {
        severity: "Medium",
        description: "Waste spilling on pavement",
        citizenName: "Kavya Rao",
        offsetMinutes: -95,
      },
    ],
  },
  {
    label: "Pothole cluster — north zone critical",
    groundTruthCategory: "high_priority",
    groundTruthVerified: true,
    category: "Roads",
    issueType: "pothole",
    zone: "North Zone",
    baseLat: 28.66,
    baseLon: 77.21,
    reports: [
      {
        severity: "Critical",
        description: "Series of deep potholes",
        citizenName: "Tara Krishnan",
        offsetMinutes: -20,
      },
      {
        severity: "High",
        description: "Multiple potholes damaging bikes",
        citizenName: "Vivek Anand",
        offsetMinutes: -18,
      },
      {
        severity: "High",
        description: "Potholes dangerous in rain",
        citizenName: "Anjali Deshpande",
        offsetMinutes: -15,
      },
    ],
    evidence: [
      {
        sourceType: "Citizen photo",
        sourceStatus: "High Quality",
        observedOffsetMinutes: -19,
        details: "Photo of pothole cluster",
      },
    ],
  },

  // ---- LOW/MEDIUM PRIORITY (ground truth: false) ----
  {
    label: "Small pothole — single low-severity report",
    groundTruthCategory: "normal",
    groundTruthVerified: false,
    category: "Roads",
    issueType: "pothole",
    zone: "South Zone",
    baseLat: 28.57,
    baseLon: 77.2,
    reports: [
      {
        severity: "Low",
        description: "Small pothole, minor",
        citizenName: "Raj Malhotra",
        offsetMinutes: -200,
      },
    ],
  },
  {
    label: "Single streetlight flicker — isolated",
    groundTruthCategory: "normal",
    groundTruthVerified: false,
    category: "Street Lighting",
    issueType: "streetlight_not_working",
    zone: "East Zone",
    baseLat: 28.635,
    baseLon: 77.245,
    reports: [
      {
        severity: "Low",
        description: "One streetlight flickering",
        citizenName: "Sneha Kapoor",
        offsetMinutes: -300,
      },
    ],
  },
  {
    label: "Minor litter — single report",
    groundTruthCategory: "normal",
    groundTruthVerified: false,
    category: "Waste",
    issueType: "garbage_accumulation",
    zone: "Central Zone",
    baseLat: 28.617,
    baseLon: 77.21,
    reports: [
      {
        severity: "Low",
        description: "Some litter near bus stop",
        citizenName: "Aditya Bose",
        offsetMinutes: -400,
      },
    ],
  },

  // ---- EDGE CASES / FAILURE MODES (ground truth: false — must NOT dominate) ----

  // EDGE 1: Conflicting evidence
  {
    label: "EDGE: Conflicting reports — pothole vs normal road",
    groundTruthCategory: "conflicting_evidence",
    groundTruthVerified: false,
    category: "Roads",
    issueType: "pothole",
    zone: "West Zone",
    baseLat: 28.612,
    baseLon: 77.182,
    reports: [
      {
        severity: "Critical",
        description: "Huge dangerous pothole",
        citizenName: "Citizen A",
        offsetMinutes: -25,
        conflicting: "yes",
      },
      {
        severity: "Low",
        description: "Just a small crack, not a pothole",
        citizenName: "Citizen B",
        offsetMinutes: -22,
        conflicting: "yes",
      },
    ],
  },

  // EDGE 2: Stale report (5 days old)
  {
    label: "EDGE: Stale report — critical but 5 days old",
    groundTruthCategory: "stale",
    groundTruthVerified: false,
    category: "Roads",
    issueType: "damaged_road",
    zone: "South Zone",
    baseLat: 28.582,
    baseLon: 77.195,
    reports: [
      {
        severity: "Critical",
        description: "Road badly damaged",
        citizenName: "Old Reporter",
        offsetMinutes: -5 * 24 * 60, // 5 days
      },
    ],
  },

  // EDGE 3: Duplicate spam (10 reports from same spot within minutes)
  {
    label: "EDGE: Duplicate spam — 10 reports of same pothole",
    groundTruthCategory: "duplicate",
    groundTruthVerified: false,
    category: "Roads",
    issueType: "pothole",
    zone: "Central Zone",
    baseLat: 28.614,
    baseLon: 77.2095,
    reports: Array.from({ length: 10 }, (_, i) => ({
      severity: "Critical",
      description: "Terrible pothole here",
      citizenName: `Spammer ${i + 1}`,
      offsetMinutes: -10 + i * 0.5,
      // Fixed identical coordinates so all 10 reports are within the 25m
      // duplicate threshold and deduplicated to 1 unique (no random spread).
      lat: 28.614,
      lon: 77.2095,
    })),
  },

  // EDGE 4: Responder rejection (false alarm)
  {
    label: "EDGE: Responder rejected — false alarm",
    groundTruthCategory: "responder_rejected",
    groundTruthVerified: false,
    category: "Waste",
    issueType: "illegal_dumping",
    zone: "Industrial Park",
    baseLat: 28.595,
    baseLon: 77.265,
    reports: [
      {
        severity: "Critical",
        description: "Hazardous waste dumped!",
        citizenName: "Alarmed Citizen",
        offsetMinutes: -40,
      },
    ],
    verifications: [
      {
        responderName: "Officer Kapoor",
        status: "Rejected",
        notes: "Inspected site, no hazardous waste found — false alarm",
        offsetMinutes: -20,
      },
    ],
  },

  // EDGE 5: Missing location (critical severity but no GPS)
  {
    label: "EDGE: Missing location — critical but no coordinates",
    groundTruthCategory: "missing_location",
    groundTruthVerified: false,
    category: "Street Lighting",
    issueType: "dark_area",
    zone: "North Zone",
    baseLat: 28.655,
    baseLon: 77.225,
    reports: [
      {
        severity: "Critical",
        description: "Very dark area, cannot specify exact spot",
        citizenName: "Citizen without GPS",
        offsetMinutes: -35,
        missingLocation: true,
      },
    ],
  },

  // EDGE 6: Missing evidence / insufficient data
  {
    label: "EDGE: Missing evidence — single low report, no data",
    groundTruthCategory: "missing_evidence",
    groundTruthVerified: false,
    category: "Waste",
    issueType: "overflowing_bin",
    zone: "Harbor District",
    baseLat: 28.602,
    baseLon: 77.272,
    reports: [
      {
        severity: "Medium",
        description: "Bin maybe overflowing, not sure",
        citizenName: "Unsure Citizen",
        offsetMinutes: -70,
      },
    ],
    // no evidence, single weak report
  },
];

/**
 * Seed the database with the reproducible experiment. Wipes existing data first.
 */
export async function seedDatabase() {
  // Wipe
  await db.auditLog.deleteMany();
  await db.evaluationLabel.deleteMany();
  await db.responderVerification.deleteMany();
  await db.externalEvidence.deleteMany();
  await db.incidentReport.deleteMany();
  await db.incident.deleteMany();
  await db.report.deleteMany();
  await db.user.deleteMany();

  // Seed demo users (one per role)
  const users = await Promise.all(
    [
      { email: "citizen@demo.in", name: "Demo Citizen", role: "citizen", zone: null },
      { email: "officer@demo.in", name: "Officer Desai", role: "officer", zone: "Central Zone" },
      { email: "coordinator@demo.in", name: "Coord. Mehta", role: "coordinator", zone: null },
      { email: "admin@demo.in", name: "Admin User", role: "admin", zone: null },
    ].map((u) =>
      db.user.create({
        data: { email: u.email, name: u.name, role: u.role, zone: u.zone, isActive: true },
      })
    )
  );

  const evaluationRecords: Array<{
    incidentLabel: string;
    incidentIdStr: string;
    reportId: string;
    groundTruthVerified: boolean;
    groundTruthCategory: string;
    proposedPriorityScore: number;
    baselinePriorityScore: number;
    status: string;
    confidenceScore: number;
  }> = [];

  for (const scenario of SEED_SCENARIOS) {
    const incidentIdStr = newIncidentId();
    const incident = await db.incident.create({
      data: {
        incidentId: incidentIdStr,
        category: scenario.category,
        issueType: scenario.issueType,
        zone: scenario.zone,
        latitude: scenario.baseLat,
        longitude: scenario.baseLon,
        status: "Pending",
      },
    });

    for (const r of scenario.reports) {
      const reportIdStr = newReportId();
      const hasLocation = !r.missingLocation;
      const lat = r.lat !== undefined ? r.lat : hasLocation ? scenario.baseLat + (Math.random() - 0.5) * 0.0008 : null;
      const lon = r.lon !== undefined ? r.lon : hasLocation ? scenario.baseLon + (Math.random() - 0.5) * 0.0008 : null;
      const reportedTime = mins(r.offsetMinutes);
      const report = await db.report.create({
        data: {
          reportId: reportIdStr,
          category: scenario.category,
          issueType: scenario.issueType,
          description: r.description,
          zone: scenario.zone,
          latitude: lat as any,
          longitude: lon as any,
          reportedTime,
          citizenSeverity: r.severity,
          citizenName: r.citizenName,
          locationStatus: hasLocation ? "Available" : "Missing",
          freshnessStatus: "Pending",
          conflictingEvidence: r.conflicting || "no",
        },
      });
      await db.incidentReport.create({
        data: { incidentId: incident.id, reportId: report.id },
      });

      // Tag first report of each incident with the ground-truth label
      if (r === scenario.reports[0]) {
        evaluationRecords.push({
          incidentLabel: scenario.label,
          incidentIdStr,
          reportId: report.id,
          groundTruthVerified: scenario.groundTruthVerified,
          groundTruthCategory: scenario.groundTruthCategory,
          proposedPriorityScore: 0,
          baselinePriorityScore: 0,
          status: "",
          confidenceScore: 0,
        });
      }
    }

    // Evidence
    if (scenario.evidence) {
      for (const e of scenario.evidence) {
        await db.externalEvidence.create({
          data: {
            evidenceId: newEvidenceId(),
            incidentId: incident.id,
            sourceType: e.sourceType,
            sourceStatus: e.corrupted ? "Corrupted" : e.sourceStatus,
            observedAt: mins(e.observedOffsetMinutes),
            freshnessStatus:
              Math.abs(e.observedOffsetMinutes) / 60 <= 24
                ? "Fresh"
                : Math.abs(e.observedOffsetMinutes) / 60 <= 72
                ? "Aging"
                : "Stale",
            details: e.details,
            latitude: scenario.baseLat,
            longitude: scenario.baseLon,
          },
        });
      }
    }

    // Verifications
    if (scenario.verifications) {
      for (const v of scenario.verifications) {
        await db.responderVerification.create({
          data: {
            incidentId: incident.id,
            responderId: users[1].id,
            responderName: v.responderName,
            verificationStatus: v.status,
            notes: v.notes ?? null,
            verifiedAt: mins(v.offsetMinutes),
          },
        });
        await db.incident.update({
          where: { id: incident.id },
          data: { humanStatus: v.status },
        });
      }
    }

    await db.auditLog.create({
      data: {
        incidentId: incident.id,
        action: "report_submitted",
        details: `Seeded scenario: ${scenario.label}`,
      },
    });

    // Recompute and store evaluation
    const result = await recomputeIncident(incident.id);
    if (result) {
      const rec = evaluationRecords.find((r) => r.incidentIdStr === incidentIdStr);
      if (rec) {
        rec.proposedPriorityScore = result.evaluation.priorityScore;
        rec.baselinePriorityScore = baselinePriorityScore(result.reports);
        rec.status = result.evaluation.status;
        rec.confidenceScore = result.evaluation.confidenceScore;
      }
    }
  }

  // Persist evaluation labels with ground truth + ranks
  const allIncidents = await db.incident.findMany({
    include: {
      incidentLinks: { include: { report: true } },
      evidence: true,
      responderVerifications: true,
    },
  });

  // Baseline ranking
  const baselineRanked = [...allIncidents]
    .map((i) => ({
      incident: i,
      score: baselinePriorityScore(
        i.incidentLinks.map((l) => ({
          id: l.report.id,
          reportId: l.report.reportId,
          category: l.report.category,
          issueType: l.report.issueType,
          citizenSeverity: l.report.citizenSeverity,
          reportedTime: l.report.reportedTime,
          description: l.report.description,
          latitude: l.report.latitude,
          longitude: l.report.longitude,
          conflictingEvidence: l.report.conflictingEvidence,
          zone: l.report.zone,
          createdAt: l.report.createdAt,
        } as any))
      ),
    }))
    .sort((a, b) => b.score - a.score);

  // Proposed ranking
  const proposedRanked = [...allIncidents]
    .map((i) => ({ incident: i, score: i.priorityScore }))
    .sort((a, b) => b.score - a.score);

  for (const rec of evaluationRecords) {
    const baselineRank =
      baselineRanked.findIndex((r) => r.incident.id === rec.incidentIdStr.replace(/^INC-/, "")) + 1 ||
      baselineRanked.findIndex((r) => r.incident.incidentId === rec.incidentIdStr) + 1;
    const proposedRank =
      proposedRanked.findIndex((r) => r.incident.incidentId === rec.incidentIdStr) + 1;
    await db.evaluationLabel.create({
      data: {
        reportId: rec.reportId,
        incidentId: rec.incidentIdStr,
        groundTruthVerified: rec.groundTruthVerified,
        groundTruthCategory: rec.groundTruthCategory,
        simulatedConfidenceScore: rec.confidenceScore,
        simulatedVerificationState: rec.status,
        simulatedPriorityScore: rec.proposedPriorityScore,
        baselinePriorityScore: rec.baselinePriorityScore,
        baselineRank: baselineRank || null,
        proposedRank: proposedRank || null,
      },
    });
  }

  await db.auditLog.create({
    data: {
      action: "seed_run",
      details: `Seeded ${SEED_SCENARIOS.length} reproducible scenarios at ${new Date().toISOString()}`,
    },
  });

  return {
    users: users.length,
    incidents: allIncidents.length,
    scenarios: SEED_SCENARIOS.length,
  };
}
