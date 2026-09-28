"use client";

import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Incident } from "@/lib/types";
import {
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidents: Incident[];
  onDone: () => void;
  responderName: string;
}

export function BulkActionsSheet({
  open,
  onOpenChange,
  incidents,
  onDone,
  responderName,
}: Props) {
  const [decision, setDecision] = useState("VERIFY");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (incidents.length === 0) return;
    setBusy(true);
    try {
      const ids = incidents.map((i) => i.incidentId);
      const res = await api<{
        message: string;
        succeeded: number;
        failed: number;
        results: any[];
      }>("/api/incidents/bulk-verify", {
        method: "POST",
        body: JSON.stringify({ ids, decision, responderName, rationale }),
      });
      toast.success(res.message);
      setRationale("");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const decisionLabel: Record<string, string> = {
    VERIFY: "Verify all (confirm incidents)",
    REJECT: "Reject all (false alarms)",
    ESCALATE: "Mark all as needs more evidence",
  };

  const decisionIcon: Record<string, React.ReactNode> = {
    VERIFY: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
    REJECT: <XCircle className="h-4 w-4 text-rose-600" />,
    ESCALATE: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="cv-scroll w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Bulk Responder Action
          </SheetTitle>
          <SheetDescription>
            Apply a single verification decision to {incidents.length} selected
            incidents at once. Each incident's confidence will be recomputed
            immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Selected incidents list */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selected incidents ({incidents.length})
            </p>
            <div className="cv-scroll max-h-40 space-y-1 overflow-y-auto">
              {incidents.map((inc) => (
                <div key={inc.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate font-mono">{inc.incidentId}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {inc.category} · P{inc.priorityScore}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div>
            <Label className="text-xs font-semibold">Decision</Label>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VERIFY">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Verify (confirm incidents)
                  </span>
                </SelectItem>
                <SelectItem value="REJECT">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    Reject (false alarms)
                  </span>
                </SelectItem>
                <SelectItem value="ESCALATE">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Needs more evidence
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rationale */}
          <div>
            <Label className="text-xs font-semibold">
              Rationale (applied to all {incidents.length} incidents)
            </Label>
            <Textarea
              placeholder="e.g. 'Field team confirmed all incidents during morning patrol'"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="mt-1 min-h-[70px] text-xs"
            />
          </div>

          {/* Responder name */}
          <div>
            <Label className="text-xs font-semibold">Responder</Label>
            <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {responderName}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-md border bg-primary/5 p-3 text-xs">
            <div className="flex items-center gap-2">
              {decisionIcon[decision]}
              <span className="font-semibold">{decisionLabel[decision]}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              This will override the confidence score for all selected incidents
              and record a verification entry in each incident's audit timeline.
            </p>
          </div>

          <Button onClick={apply} disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : decision === "VERIFY" ? (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            ) : (
              <ShieldCheck className="mr-1 h-4 w-4" />
            )}
            Apply to {incidents.length} incidents
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
