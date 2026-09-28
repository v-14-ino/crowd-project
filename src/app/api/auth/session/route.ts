import { NextRequest, NextResponse } from "next/server";
import { setSession, DEMO_USERS_LIST } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const role = body.role ?? "officer";
  const user = await setSession(role);
  return NextResponse.json({ user, users: DEMO_USERS_LIST });
}

export async function GET() {
  return NextResponse.json({ users: DEMO_USERS_LIST });
}
