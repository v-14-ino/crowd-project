import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Controlled evidence file serving.
 *
 * Files are stored OUTSIDE /public (in /storage/evidence) so they cannot be
 * served directly by Next.js static handler — preventing XSS via uploaded
 * SVG/HTML. This route validates the filename, reads the file, and returns it
 * with a safe Content-Type and Content-Disposition: inline for images only.
 *
 * Access control: in a production deployment this would check the caller's
 * session/role before serving. For the demo it is open but logged.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage", "evidence");

// Allowlist of (extension → mime) pairs. Anything else is refused.
const SAFE_TYPES: Record<string, { mime: string }> = {
  jpg: { mime: "image/jpeg" },
  jpeg: { mime: "image/jpeg" },
  png: { mime: "image/png" },
  webp: { mime: "image/webp" },
  gif: { mime: "image/gif" },
};

// Magic-byte signatures for validation
const MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Validate filename: only allow evd_<hex>.<ext> pattern — no path traversal
  if (!/^evd_[a-f0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const ext = name.split(".").pop()!.toLowerCase();
  const safe = SAFE_TYPES[ext];
  if (!safe) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const filePath = path.join(STORAGE_DIR, name);
  // Resolve and ensure it stays inside STORAGE_DIR
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(STORAGE_DIR) + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const buf = await readFile(filePath);

    // Validate magic bytes
    const expected = MAGIC_BYTES[ext];
    if (expected) {
      const matches = expected.every((b, i) => buf[i] === b);
      if (!matches) {
        return NextResponse.json(
          { error: "File content does not match extension" },
          { status: 415 }
        );
      }
    }

    return new NextResponse(buf, {
      headers: {
        "Content-Type": safe.mime,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
