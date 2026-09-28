/**
 * Simple demo session helper.
 *
 * The original project used JWT auth against a User table. For this demo we
 * use a lightweight cookie-based session that lets the user switch between
 * the four roles (citizen / officer / coordinator / admin) instantly so the
 * role-based views can be demonstrated end-to-end. The session is signed
 * with a HMAC of the role payload.
 */

import { cookies } from "next/headers";
import { createHmac } from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "municipality-crowd-verification-demo-secret";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "citizen" | "officer" | "coordinator" | "admin";
  zone?: string | null;
}

const DEMO_USERS: Record<string, SessionUser> = {
  citizen: {
    id: "demo-citizen",
    email: "citizen@demo.in",
    name: "Demo Citizen",
    role: "citizen",
  },
  officer: {
    id: "demo-officer",
    email: "officer@demo.in",
    name: "Officer Desai",
    role: "officer",
    zone: "Central Zone",
  },
  coordinator: {
    id: "demo-coordinator",
    email: "coordinator@demo.in",
    name: "Coord. Mehta",
    role: "coordinator",
  },
  admin: {
    id: "demo-admin",
    email: "admin@demo.in",
    name: "Admin User",
    role: "admin",
  },
};

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get("cvd_session")?.value;
  if (!raw) return DEMO_USERS.officer; // default to officer view for demo
  try {
    const [role, sig] = raw.split(".");
    if (sign(role) !== sig) return DEMO_USERS.officer;
    return DEMO_USERS[role] ?? DEMO_USERS.officer;
  } catch {
    return DEMO_USERS.officer;
  }
}

export async function setSession(role: string): Promise<SessionUser> {
  const user = DEMO_USERS[role] ?? DEMO_USERS.officer;
  const store = await cookies();
  store.set("cvd_session", `${role}.${sign(role)}`, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return user;
}

export const DEMO_USERS_LIST = Object.values(DEMO_USERS);
