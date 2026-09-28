/**
 * Correlation service — groups incoming reports into existing incidents.
 * Ported from backend/services/correlation_service.py.
 *
 * A report matches an incident when (same category + issueType) AND
 * reported time within ±60 minutes AND haversine distance ≤ 200m.
 */

import type { Report, Incident } from "@/lib/types";
import {
  haversineDistanceMeters,
  CORRELATION_DISTANCE_THRESHOLD_METERS,
  CORRELATION_TIME_THRESHOLD_MINUTES,
} from "@/lib/verification-engine";

export function reportsMatch(a: Report, b: Report): boolean {
  if (a.category !== b.category) return false;
  if (a.issueType !== b.issueType) return false;
  if (!a.reportedTime || !b.reportedTime) return false;
  const diffMin =
    Math.abs(
      new Date(a.reportedTime).getTime() - new Date(b.reportedTime).getTime()
    ) / 60000;
  if (diffMin > CORRELATION_TIME_THRESHOLD_MINUTES) return false;
  if (a.latitude == null || a.longitude == null) return false;
  if (b.latitude == null || b.longitude == null) return false;
  const dist = haversineDistanceMeters(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude
  );
  return dist <= CORRELATION_DISTANCE_THRESHOLD_METERS;
}

/**
 * Given an incoming report and a list of candidate incidents (each with its reports),
 * return the matching incident id or null.
 */
export function findMatchingIncident(
  incoming: Report,
  candidates: { incident: Incident; reports: Report[] }[]
): string | null {
  for (const c of candidates) {
    for (const existing of c.reports) {
      if (reportsMatch(incoming, existing)) return c.incident.id;
    }
  }
  return null;
}
