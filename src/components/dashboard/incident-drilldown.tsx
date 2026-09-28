"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  StatusBadge,
  FreshnessBadge,
  PriorityBadge,
  ConfidenceBadge,
  CategoryBadge,
  OpStateBadges,
  ConfidenceBar,
  PriorityBar,
} from "@/components/dashboard/badges";
import { api, formatDateTime, timeAgo } from "@/lib/api-client";
import { ISSUE_TYPE_LABELS, type IncidentDetail } from "@/lib/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  Users,
  FileImage,
  ShieldCheck,
  Activity,
  Lightbulb,
  AlertTriangle,
  Plus,
  History,
  XCircle,
} from "lucide-react";

interface Props {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  responderName?: string;
}

export function IncidentDrilldown({
  incidentId,
  open,
  onOpenChange,
  onChanged,
  responderName = "Officer Desai",
}: Props) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState("VERIFY");
  const [rationale, setRationale] = useState("");
  const [evType, setEvType] = useState("Citizen photo");
  const [evStatus, setEvStatus] = useState("High Quality");
  const [evDetails, setEvDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !incidentId) return;
    setLoading(true);
    api<IncidentDetail>(`/api/incidents/${incidentId}`)
      .then(setDetail)
      .catch((e) => toast.error(`Failed to load incident: ${e.message}`))
      .finally(() => setLoading(false));
  }, [open, incidentId]);

  async function submitVerification() {
    if (!incidentId) return;
    setBusy(true);
    try {
      await api(`/api/incidents/${incidentId}/verification`, {
        method: "POST",
        body: JSON.stringify({ decision, responderName, rationale }),
      });
      toast.success("Verification recorded");
      const fresh = await api<IncidentDetail>(`/api/incidents/${incidentId}`);
      setDetail(fresh);
      setRationale("");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function attachEvidence() {
    if (!incidentId) return;
    setBusy(true);
    try {
      await api(`/api/incidents/${incidentId}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          sourceType: evType,
          sourceStatus: evStatus,
          details: evDetails || `Simulated ${evType}`,
        }),
      });
      toast.success("Evidence attached — confidence recomputed");
      const fresh = await api<IncidentDetail>(`/api/incidents/${incidentId}`);
      setDetail(fresh);
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="cv-scroll w-full overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
            {detail ? (
              <>
                <CategoryBadge category={detail.category} issueType={detail.issueType} />
                <span className="font-mono text-sm text-muted-foreground">
                  {detail.incidentId}
                </span>
              </>
            ) : (
              "Loading incident..."
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed drill-down view of the selected incident including confidence
            breakdown, evidence, reports, and verification history.
          </SheetDescription>
        </SheetHeader>

        {loading && !detail && (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        )}

        {detail && (
          <div className="mt-4 space-y-4">
            {/* Status summary band */}
            <div className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} />
                <PriorityBadge level={detail.priorityLevel} score={detail.priorityScore} />
                <ConfidenceBadge level={detail.confidenceLevel} score={detail.confidenceScore} />
                <FreshnessBadge freshness={detail.freshnessStatus} />
              </div>
              {detail.operationalStates.length > 0 && (
                <div className="mt-2">
                  <OpStateBadges states={detail.operationalStates} />
                </div>
              )}
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 dark:bg-amber-950/30">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold">Recommended action: </span>
                  {detail.recommendedAction}
                </p>
              </div>
            </div>

            {/* WHAT / WHERE / WHEN */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoCard
                icon={<MapPin className="h-4 w-4 text-emerald-600" />}
                title="Where"
              >
                {detail.latitude != null && detail.longitude != null ? (
                  <>
                    <p className="font-mono text-xs">
                      {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                    </p>
                    {detail.zone && <p className="text-xs text-muted-foreground">{detail.zone}</p>}
                  </>
                ) : (
                  <p className="text-xs text-amber-600">Missing coordinates</p>
                )}
              </InfoCard>
              <InfoCard
                icon={<Clock className="h-4 w-4 text-emerald-600" />}
                title="When"
              >
                <p className="text-xs">
                  Reported {detail.lastReportedTime ? timeAgo(detail.lastReportedTime) : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {detail.lastReportedTime ? formatDateTime(detail.lastReportedTime) : ""}
                </p>
              </InfoCard>
              <InfoCard
                icon={<Users className="h-4 w-4 text-emerald-600" />}
                title="Reports"
              >
                <p className="text-xs">
                  <span className="font-semibold">{detail.independentReportsCount}</span> independent
                  {" / "}
                  <span className="font-semibold">{detail.totalReportsCount}</span> total
                </p>
                {detail.duplicateReportsCount > 0 && (
                  <p className="text-[10px] text-amber-600">
                    {detail.duplicateReportsCount} filtered as duplicate
                  </p>
                )}
              </InfoCard>
            </div>

            {/* Explainable confidence */}
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Explainable Confidence</h3>
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confidence score</span>
                  <span className="font-semibold">{detail.confidenceScore}/100 ({detail.confidenceLevel})</span>
                </div>
                <ConfidenceBar score={detail.confidenceScore} level={detail.confidenceLevel} />
              </div>
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Priority score</span>
                  <span className="font-semibold">{detail.priorityScore}/100 ({detail.priorityLevel})</span>
                </div>
                <PriorityBar score={detail.priorityScore} level={detail.priorityLevel} />
              </div>

              {/* Structured breakdown */}
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Confidence breakdown
                </p>
                <div className="space-y-1">
                  {detail.confidenceBreakdown.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            b.kind === "bonus"
                              ? "text-emerald-600"
                              : b.kind === "penalty"
                              ? "text-rose-600"
                              : b.kind === "override"
                              ? "text-violet-600"
                              : "text-muted-foreground"
                          }
                        >
                          {b.delta > 0 ? `+${b.delta}` : b.delta === 0 ? "0" : `${b.delta}`}
                        </span>
                        <span className="font-medium">{b.label}</span>
                      </div>
                      <span className="max-w-[55%] truncate text-[10px] text-muted-foreground">
                        {b.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Human explanation */}
              <div className="mt-3 rounded-md bg-primary/5 p-2.5">
                <p className="text-xs leading-relaxed text-foreground">
                  <span className="font-semibold">Human explanation: </span>
                  {detail.confidenceHumanSummary}
                </p>
              </div>

              {/* Priority explanations */}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Priority calculation details
                </summary>
                <ul className="mt-1.5 space-y-1 pl-4 text-[11px] text-muted-foreground">
                  {detail.priorityExplanations.map((p, i) => (
                    <li key={i} className="list-disc">{p}</li>
                  ))}
                </ul>
              </details>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  Confidence calculation details
                </summary>
                <ul className="mt-1.5 space-y-1 pl-4 text-[11px] text-muted-foreground">
                  {detail.confidenceExplanations.map((p, i) => (
                    <li key={i} className="list-disc">{p}</li>
                  ))}
                </ul>
              </details>
            </section>

            {/* Citizen reports */}
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Citizen Reports ({detail.reports.length})
                </h3>
              </div>
              <div className="cv-scroll max-h-64 space-y-2 overflow-y-auto">
                {detail.reports.map((r) => {
                  const isDup = detail.duplicateReports.some((d) => d.id === r.id);
                  return (
                    <div
                      key={r.id}
                      className={`rounded-md border p-2.5 text-xs ${isDup ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-muted-foreground">{r.reportId}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">{r.citizenSeverity}</Badge>
                          {isDup && <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100 text-amber-800">duplicate</Badge>}
                        </div>
                      </div>
                      <p className="mt-1 text-foreground">{r.description}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>by {r.citizenName || "anonymous"}</span>
                        <span>· {timeAgo(r.reportedTime)}</span>
                        {r.latitude != null && (
                          <span>· {r.latitude.toFixed(4)}, {r.longitude?.toFixed(4)}</span>
                        )}
                        {r.latitude == null && <span className="text-amber-600">· no GPS</span>}
                        {r.conflictingEvidence === "yes" && (
                          <span className="text-rose-600">· conflicting</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Evidence */}
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileImage className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Evidence ({detail.evidence.length})
                </h3>
              </div>
              {detail.evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground">No evidence attached yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.evidence.map((e) => (
                    <div key={e.id} className="rounded-md border p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{e.sourceType}</span>
                        <Badge
                          variant="outline"
                          className={
                            e.sourceStatus === "Verified" || e.sourceStatus === "High Quality"
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : e.sourceStatus === "Corrupted"
                              ? "border-rose-300 bg-rose-100 text-rose-800"
                              : ""
                          }
                        >
                          {e.sourceStatus}
                        </Badge>
                      </div>
                      {e.details && <p className="mt-1 text-muted-foreground">{e.details}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        observed {timeAgo(e.observedAt)} · {e.evidenceId}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Attach evidence (simulated) */}
              <Separator className="my-3" />
              <div className="space-y-2">
                <p className="text-xs font-semibold">Attach evidence (simulated)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Source type</Label>
                    <Select value={evType} onValueChange={setEvType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Citizen photo", "CCTV", "Sensor", "Drone", "Field officer"].map((o) => (
                          <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Source status</Label>
                    <Select value={evStatus} onValueChange={setEvStatus}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Standard", "High Quality", "Verified", "Corrupted"].map((o) => (
                          <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input
                  placeholder="Details (optional)"
                  value={evDetails}
                  onChange={(e) => setEvDetails(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="secondary" onClick={attachEvidence} disabled={busy} className="w-full">
                  <Plus className="mr-1 h-3 w-3" />
                  Attach evidence & recompute
                </Button>
              </div>
            </section>

            {/* Verification history */}
            <section className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Verification History ({detail.responderVerifications.length})
                </h3>
              </div>
              {detail.responderVerifications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No responder verification yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.responderVerifications.map((v) => (
                    <div key={v.id} className="rounded-md border p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{v.responderName}</span>
                        <Badge
                          variant="outline"
                          className={
                            v.verificationStatus === "Verified"
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : v.verificationStatus === "Rejected"
                              ? "border-rose-300 bg-rose-100 text-rose-800"
                              : "border-amber-300 bg-amber-100 text-amber-800"
                          }
                        >
                          {v.verificationStatus}
                        </Badge>
                      </div>
                      {v.notes && <p className="mt-1 text-muted-foreground">{v.notes}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDateTime(v.verifiedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Responder action */}
              <Separator className="my-3" />
              <div className="space-y-2">
                <p className="text-xs font-semibold">Responder action</p>
                <Input
                  value={responderName}
                  readOnly
                  className="h-8 text-xs"
                />
                <Select value={decision} onValueChange={setDecision}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VERIFY" className="text-xs">Verify (confirm incident)</SelectItem>
                    <SelectItem value="REJECT" className="text-xs">Reject (false alarm)</SelectItem>
                    <SelectItem value="ESCALATE" className="text-xs">Needs more evidence</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Rationale (optional)"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
                <Button size="sm" onClick={submitVerification} disabled={busy} className="w-full">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Submit verification
                </Button>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
