import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  try {
    const result = await seedDatabase();
    return NextResponse.json({
      message: "Database seeded with reproducible simulated experiment",
      ...result,
    });
  } catch (e: any) {
    console.error("Seed error:", e);
    return NextResponse.json(
      {
        error: "Seed failed",
        detail: e?.message ?? String(e),
        stack: e?.stack?.split("\n").slice(0, 8),
      },
      { status: 500 }
    );
  }
}
