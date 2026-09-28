/**
 * PostgreSQL verification script — verifies the Prisma schema's DDL + full
 * data flow against an in-memory PostgreSQL (PGlite) instance.
 *
 * This genuinely tests that the schema (CREATE TABLE statements equivalent to
 * the Prisma model) works on PostgreSQL, and that the verification engine
 * produces correct results against PostgreSQL-stored data.
 *
 * Run: bunx tsx scripts/verify-postgres.ts
 */

import { PGlite } from "@electric-sql/pglite";
import { evaluateIncident } from "@/lib/verification-engine";

let pass = 0;
let fail = 0;
function check(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

async function main() {
  console.log("=== PostgreSQL Verification (PGlite) ===\n");

  // 1. Start in-memory PostgreSQL
  const pg = await PGlite.create();
  console.log("Started in-memory PostgreSQL (PGlite)");

  // 2. Push schema — CREATE TABLE statements matching prisma/schema.prisma
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen',
      zone TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "passwordHash" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "Incident" (
      id TEXT PRIMARY KEY,
      "incidentId" TEXT NOT NULL UNIQUE,
      category TEXT,
      "issueType" TEXT,
      zone TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      "humanStatus" TEXT NOT NULL DEFAULT 'Awaiting Review',
      "priorityScore" INTEGER NOT NULL DEFAULT 0,
      "priorityLevel" TEXT NOT NULL DEFAULT 'Low',
      "confidenceScore" INTEGER NOT NULL DEFAULT 0,
      "confidenceLevel" TEXT NOT NULL DEFAULT 'Low',
      "freshnessStatus" TEXT NOT NULL DEFAULT 'Fresh',
      "totalReportsCount" INTEGER NOT NULL DEFAULT 1,
      "independentReportsCount" INTEGER NOT NULL DEFAULT 1,
      "duplicateReportsCount" INTEGER NOT NULL DEFAULT 0,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      "lastReportedTime" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "Report" (
      id TEXT PRIMARY KEY,
      "reportId" TEXT NOT NULL UNIQUE,
      category TEXT,
      "issueType" TEXT,
      description TEXT,
      zone TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      "reportedTime" TIMESTAMP(3),
      "citizenSeverity" TEXT,
      "citizenName" TEXT,
      "corroboratingReports" INTEGER,
      "locationStatus" TEXT,
      "freshnessStatus" TEXT,
      "conflictingEvidence" TEXT,
      "reporterId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "IncidentReport" (
      id TEXT PRIMARY KEY,
      "incidentId" TEXT NOT NULL REFERENCES "Incident"(id) ON DELETE CASCADE,
      "reportId" TEXT NOT NULL UNIQUE REFERENCES "Report"(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "ExternalEvidence" (
      id TEXT PRIMARY KEY,
      "evidenceId" TEXT UNIQUE,
      "incidentId" TEXT NOT NULL REFERENCES "Incident"(id) ON DELETE CASCADE,
      "reportId" TEXT REFERENCES "Report"(id) ON DELETE SET NULL,
      "sourceType" TEXT,
      "sourceStatus" TEXT,
      "observedAt" TIMESTAMP(3),
      "freshnessStatus" TEXT,
      details TEXT,
      "fileName" TEXT,
      "filePath" TEXT,
      "fileUrl" TEXT,
      "fileSize" INTEGER,
      "mimeType" TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "ResponderVerification" (
      id TEXT PRIMARY KEY,
      "incidentId" TEXT NOT NULL REFERENCES "Incident"(id) ON DELETE CASCADE,
      "responderId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      "responderName" TEXT,
      "verificationStatus" TEXT,
      notes TEXT,
      "verifiedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "EvaluationLabel" (
      id TEXT PRIMARY KEY,
      "reportId" TEXT NOT NULL UNIQUE REFERENCES "Report"(id) ON DELETE CASCADE,
      "incidentId" TEXT,
      "groundTruthVerified" BOOLEAN,
      "groundTruthCategory" TEXT,
      "simulatedConfidenceScore" DOUBLE PRECISION,
      "simulatedVerificationState" TEXT,
      "simulatedPriorityScore" DOUBLE PRECISION,
      "simulatedPriority" TEXT,
      "baselinePriorityScore" DOUBLE PRECISION,
      "baselineRank" INTEGER,
      "proposedRank" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      id TEXT PRIMARY KEY,
      "incidentId" TEXT REFERENCES "Incident"(id) ON DELETE CASCADE,
      "actorId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      "actorRole" TEXT,
      action TEXT,
      details TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
    CREATE INDEX IF NOT EXISTS "Incident_incidentId_idx" ON "Incident"("incidentId");
    CREATE INDEX IF NOT EXISTS "Report_reportId_idx" ON "Report"("reportId");
  `);
  check(true, "schema (8 tables + indexes) created on PostgreSQL");

  // 3. Create user (RBAC)
  await pg.query(
    `INSERT INTO "User" (id, email, name, role, zone, "isActive") VALUES ($1, $2, $3, $4, $5, $6)`,
    ["pg-user-1", "officer@pg-test.in", "PG Officer", "officer", "Central Zone", true]
  );
  const userRes = await pg.query(`SELECT * FROM "User" WHERE email = $1`, ["officer@pg-test.in"]);
  check(userRes.rows.length === 1, "user (RBAC) created + queried on PostgreSQL");

  // 4. Create incident
  await pg.query(
    `INSERT INTO "Incident" (id, "incidentId", category, "issueType", zone, latitude, longitude, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    ["pg-inc-1", "PG-INC-001", "Roads", "pothole", "Central Zone", 28.614, 77.209, "Pending"]
  );
  const incRes = await pg.query(`SELECT * FROM "Incident" WHERE "incidentId" = $1`, ["PG-INC-001"]);
  check(incRes.rows.length === 1, "incident created on PostgreSQL");
  check(incRes.rows[0].category === "Roads", "incident category = Roads (all 3 categories supported)");

  // 5. Create report + link to incident
  await pg.query(
    `INSERT INTO "Report" (id, "reportId", category, "issueType", description, zone, latitude, longitude, "reportedTime", "citizenSeverity", "citizenName", "locationStatus", "freshnessStatus", "conflictingEvidence") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    ["pg-rpt-1", "PG-RPT-001", "Roads", "pothole", "Large pothole near junction", "Central Zone", 28.614, 77.209, new Date(), "Critical", "PG Citizen", "Available", "Fresh", "no"]
  );
  await pg.query(
    `INSERT INTO "IncidentReport" (id, "incidentId", "reportId") VALUES ($1,$2,$3)`,
    ["pg-ir-1", "pg-inc-1", "pg-rpt-1"]
  );
  const rptRes = await pg.query(`SELECT r.* FROM "Report" r JOIN "IncidentReport" ir ON r.id = ir."reportId" WHERE ir."incidentId" = $1`, ["pg-inc-1"]);
  check(rptRes.rows.length === 1, "report created + linked to incident (JOIN query works)");

  // 6. Attach evidence
  await pg.query(
    `INSERT INTO "ExternalEvidence" (id, "evidenceId", "incidentId", "sourceType", "sourceStatus", "observedAt", details) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    ["pg-evd-1", "PG-EVD-001", "pg-inc-1", "Citizen photo", "High Quality", new Date(), "Photo of pothole"]
  );
  const evdRes = await pg.query(`SELECT * FROM "ExternalEvidence" WHERE "incidentId" = $1`, ["pg-inc-1"]);
  check(evdRes.rows.length === 1, "evidence created on PostgreSQL");

  // 7. Responder verification
  await pg.query(
    `INSERT INTO "ResponderVerification" (id, "incidentId", "responderId", "responderName", "verificationStatus", "verifiedAt") VALUES ($1,$2,$3,$4,$5,$6)`,
    ["pg-ver-1", "pg-inc-1", "pg-user-1", "PG Officer", "Verified", new Date()]
  );
  const verRes = await pg.query(`SELECT * FROM "ResponderVerification" WHERE "incidentId" = $1`, ["pg-inc-1"]);
  check(verRes.rows.length === 1, "responder verification created on PostgreSQL");

  // 8. Audit log
  await pg.query(
    `INSERT INTO "AuditLog" (id, "incidentId", "actorId", "actorRole", action, details) VALUES ($1,$2,$3,$4,$5,$6)`,
    ["pg-audit-1", "pg-inc-1", "pg-user-1", "officer", "responder_verified", "PG Officer marked incident Verified"]
  );
  check(true, "audit log created on PostgreSQL");

  // 9. Verification engine evaluation against PostgreSQL-stored data
  const reports = rptRes.rows.map((r: any) => ({
    id: r.id, reportId: r.reportId, category: r.category, issueType: r.issueType,
    description: r.description, zone: r.zone, latitude: r.latitude, longitude: r.longitude,
    reportedTime: r.reportedTime, citizenSeverity: r.citizenSeverity, citizenName: r.citizenName,
    corroboratingReports: null, locationStatus: r.locationStatus, freshnessStatus: r.freshnessStatus,
    conflictingEvidence: r.conflictingEvidence, createdAt: r.createdAt,
  }));
  const evidence = evdRes.rows.map((e: any) => ({
    id: e.id, evidenceId: e.evidenceId, incidentId: e.incidentId, reportId: e.reportId,
    sourceType: e.sourceType, sourceStatus: e.sourceStatus, observedAt: e.observedAt,
    freshnessStatus: e.freshnessStatus, details: e.details, fileName: e.fileName,
    fileUrl: e.fileUrl, fileSize: e.fileSize, mimeType: e.mimeType,
    latitude: e.latitude, longitude: e.longitude, createdAt: e.createdAt,
  }));
  const verifications = verRes.rows.map((v: any) => ({
    id: v.id, incidentId: v.incidentId, responderId: v.responderId,
    responderName: v.responderName, verificationStatus: v.verificationStatus,
    notes: v.notes, verifiedAt: v.verifiedAt, createdAt: v.createdAt,
  }));

  const evaluation = evaluateIncident(reports, evidence, verifications, new Date());
  check(evaluation.confidenceScore === 100, `verified incident confidence = 100 (got ${evaluation.confidenceScore})`);
  check(evaluation.status === "Verified", `status Verified (got ${evaluation.status})`);
  check(evaluation.operationalStates.includes("VERIFIED"), "VERIFIED state surfaced");

  // 10. Update incident with computed scores (simulating recomputeIncident)
  await pg.query(
    `UPDATE "Incident" SET status = $1, "confidenceScore" = $2, "confidenceLevel" = $3, "priorityScore" = $4, "priorityLevel" = $5, "freshnessStatus" = $6 WHERE id = $7`,
    [evaluation.status, evaluation.confidenceScore, evaluation.confidenceLevel,
     evaluation.priorityScore, evaluation.priorityLevel, evaluation.freshness, "pg-inc-1"]
  );
  const updated = await pg.query(`SELECT * FROM "Incident" WHERE id = $1`, ["pg-inc-1"]);
  check(updated.rows[0].confidenceScore === 100, "incident updated with computed score on PostgreSQL");
  check(updated.rows[0].status === "Verified", "incident status persisted as Verified on PostgreSQL");

  // 11. Test all 3 municipal categories
  for (const [cat, issue] of [["Roads","pothole"],["Street Lighting","streetlight_not_working"],["Waste","garbage_accumulation"]] as const) {
    const id = `pg-${cat.replace(/ /g,"-")}`;
    await pg.query(
      `INSERT INTO "Incident" (id, "incidentId", category, "issueType", zone, status) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [id, `PG-${id}`, cat, issue, "Test Zone", "Pending"]
    );
    const r = await pg.query(`SELECT * FROM "Incident" WHERE category = $1 AND "issueType" = $2`, [cat, issue]);
    check(r.rows.length >= 1, `${cat}/${issue} incident stored on PostgreSQL`);
  }

  // 12. CASCADE delete test (PostgreSQL FK behavior)
  await pg.query(`DELETE FROM "Incident" WHERE id = $1`, ["pg-inc-1"]);
  const orphanReports = await pg.query(`SELECT * FROM "IncidentReport" WHERE "incidentId" = $1`, ["pg-inc-1"]);
  check(orphanReports.rows.length === 0, "CASCADE delete works (IncidentReport removed with incident)");
  const orphanEvidence = await pg.query(`SELECT * FROM "ExternalEvidence" WHERE "incidentId" = $1`, ["pg-inc-1"]);
  check(orphanEvidence.rows.length === 0, "CASCADE delete works (ExternalEvidence removed with incident)");

  console.log(`\n=== PostgreSQL Verification: ${pass} passed, ${fail} failed ===\n`);

  await pg.close();
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("PostgreSQL verification failed:", e);
  process.exit(1);
});
