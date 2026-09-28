// Shared domain types for the Crowd-Report Verification Dashboard.
// These mirror the Prisma models but are plain serializable shapes used
// across server components, API routes, and the client.

export interface User {
  id: string;
  email: string;
  name: string;
  role: "citizen" | "officer" | "coordinator" | "admin";
  zone?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Report {
  id: string;
  reportId: string;
  category: string;
  issueType: string;
  description?: string | null;
  zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reportedTime: Date;
  citizenSeverity: string;
  citizenName?: string | null;
  corroboratingReports?: number | null;
  locationStatus?: string | null;
  freshnessStatus?: string | null;
  conflictingEvidence?: string | null;
  createdAt: Date;
}

export interface Incident {
  id: string;
  incidentId: string;
  category: string;
  issueType: string;
  zone?: string | null;
  status: string;
  humanStatus: string;
  priorityScore: number;
  priorityLevel: string;
  confidenceScore: number;
  confidenceLevel: string;
  freshnessStatus: string;
  totalReportsCount: number;
  independentReportsCount: number;
  duplicateReportsCount: number;
  latitude?: number | null;
  longitude?: number | null;
  lastReportedTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExternalEvidence {
  id: string;
  evidenceId: string;
  incidentId: string;
  reportId?: string | null;
  sourceType: string;
  sourceStatus: string;
  observedAt: Date;
  freshnessStatus?: string | null;
  details?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
}

export interface ResponderVerification {
  id: string;
  incidentId: string;
  responderId?: string | null;
  responderName: string;
  verificationStatus: "Verified" | "Rejected" | "Needs More Evidence";
  notes?: string | null;
  verifiedAt: Date;
  createdAt: Date;
}

export interface IncidentDetail extends Incident {
  reports: Report[];
  evidence: ExternalEvidence[];
  responderVerifications: ResponderVerification[];
  confidenceExplanations: string[];
  priorityExplanations: string[];
  confidenceBreakdown: {
    label: string;
    delta: number;
    detail: string;
    kind: "base" | "bonus" | "penalty" | "override";
  }[];
  confidenceHumanSummary: string;
  operationalStates: string[];
  recommendedAction: string;
  uniqueReports: Report[];
  duplicateReports: Report[];
}

export interface IncidentStats {
  totalIncidents: number;
  criticalIncidents: number;
  highPriorityIncidents: number;
  corroboratedIncidents: number;
  verifiedIncidents: number;
  pendingIncidents: number;
  conflictedIncidents: number;
  rejectedIncidents: number;
  staleIncidents: number;
  freshIncidents: number;
  missingLocationIncidents: number;
  missingEvidenceIncidents: number;
}

export type Role = "citizen" | "officer" | "coordinator" | "admin";

export const CATEGORY_OPTIONS = [
  "Roads",
  "Street Lighting",
  "Waste",
] as const;

export const CATEGORY_ISSUE_TYPES: Record<string, string[]> = {
  Roads: ["pothole", "damaged_road", "road_blockage"],
  "Street Lighting": ["streetlight_not_working", "damaged_light", "dark_area"],
  Waste: [
    "garbage_accumulation",
    "overflowing_bin",
    "illegal_dumping",
  ],
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  pothole: "Pothole",
  damaged_road: "Damaged Road",
  road_blockage: "Road Blockage",
  streetlight_not_working: "Streetlight Not Working",
  damaged_light: "Damaged Light",
  dark_area: "Dark Area",
  garbage_accumulation: "Garbage Accumulation",
  overflowing_bin: "Overflowing Bin",
  illegal_dumping: "Illegal Dumping",
};

export const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;

export const ZONES = [
  "North Zone",
  "South Zone",
  "East Zone",
  "West Zone",
  "Central Zone",
  "Harbor District",
  "Industrial Park",
  "Old Town",
] as const;
