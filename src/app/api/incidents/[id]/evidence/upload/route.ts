import { NextRequest, NextResponse } from "next/server";
import { attachEvidence } from "@/lib/db-ops";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Multipart file-upload endpoint for evidence.
 *
 * Security:
 *   - Files stored OUTSIDE /public (in /storage/evidence) — not directly
 *     servable, preventing XSS via SVG/HTML. Served via /api/uploads/evidence/[name].
 *   - Extension allowlist (jpg/jpeg/png/webp/gif only)
 *   - Magic-byte validation (content must match extension)
 *   - Size limit 10 MB
 *   - Random UUID filename (no user-controlled filename on disk)
 *   - Path traversal prevention (resolved path must stay inside STORAGE_DIR)
 */
const STORAGE_DIR = path.join(process.cwd(), "storage", "evidence");

const ALLOWED_EXT: Record<string, { mime: string }> = {
  jpg: { mime: "image/jpeg" },
  jpeg: { mime: "image/jpeg" },
  png: { mime: "image/png" },
  webp: { mime: "image/webp" },
  gif: { mime: "image/gif" },
};

const MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const sourceType = (form.get("sourceType") as string) || "Citizen photo";
  const sourceStatus = (form.get("sourceStatus") as string) || "Standard";
  const details = (form.get("details") as string) || "";
  const observedAtStr = form.get("observedAt") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // 1. Size check
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  // 2. Extension allowlist (derived from filename, not trusted)
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXT[ext]) {
    return NextResponse.json(
      {
        error: `Unsupported file extension .${ext}. Allowed: jpg, jpeg, png, webp, gif.`,
      },
      { status: 400 }
    );
  }

  // 3. Read bytes and validate magic bytes (content must match extension)
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);
  const expected = MAGIC_BYTES[ext];
  if (expected) {
    const matches = expected.every((b, i) => buf[i] === b);
    if (!matches) {
      return NextResponse.json(
        { error: "File content does not match its extension (magic byte mismatch)" },
        { status: 415 }
      );
    }
  }

  // 4. Random filename + safe path (prevent traversal)
  await mkdir(STORAGE_DIR, { recursive: true });
  const safeName = `evd_${randomUUID().slice(0, 12)}.${ext}`;
  const filePath = path.join(STORAGE_DIR, safeName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(STORAGE_DIR) + path.sep)) {
    return NextResponse.json({ error: "Invalid destination path" }, { status: 400 });
  }
  await writeFile(resolved, buf);

  // 5. Served via controlled API route (not /public)
  const fileUrl = `/api/uploads/evidence/${safeName}`;
  const observedAt = observedAtStr ? new Date(observedAtStr) : new Date();

  const result = await attachEvidence({
    incidentId: id,
    sourceType,
    sourceStatus,
    observedAt,
    details: details || `Uploaded file: ${file.name}`,
    fileName: file.name,
    filePath: resolved,
    fileUrl,
    fileSize: file.size,
    mimeType: ALLOWED_EXT[ext].mime,
  });

  if (!result) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      message: "Evidence uploaded",
      evidenceId: result.evidence.evidenceId,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      confidenceScore: result.result?.evaluation.confidenceScore,
      priorityScore: result.result?.evaluation.priorityScore,
      status: result.result?.evaluation.status,
    },
    { status: 201 }
  );
}
