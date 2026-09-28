import { NextRequest, NextResponse } from "next/server";
import { attachEvidence } from "@/lib/db-ops";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "evidence");
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Multipart file-upload endpoint for evidence.
 * Accepts: file (image), sourceType, sourceStatus, details, observedAt.
 * Saves the file to /public/uploads/evidence and creates an ExternalEvidence record.
 */
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
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type ${file.type}. Allowed: JPEG, PNG, WEBP, GIF.`,
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 413 }
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = `evd_${randomUUID().slice(0, 12)}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const fileUrl = `/uploads/evidence/${safeName}`;
  const observedAt = observedAtStr ? new Date(observedAtStr) : new Date();

  const result = await attachEvidence({
    incidentId: id,
    sourceType,
    sourceStatus,
    observedAt,
    details: details || `Uploaded file: ${file.name}`,
    fileName: file.name,
    filePath,
    fileUrl,
    fileSize: file.size,
    mimeType: file.type,
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
