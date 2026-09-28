"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import {
  CATEGORY_OPTIONS,
  CATEGORY_ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  SEVERITY_OPTIONS,
  ZONES,
} from "@/lib/types";
import { toast } from "sonner";
import {
  MapPin,
  Crosshair,
  Send,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface ReportFormProps {
  onChanged?: () => void;
}

export function ReportForm({ onChanged }: ReportFormProps) {
  const [category, setCategory] = useState<string>("Roads");
  const [issueType, setIssueType] = useState<string>("pothole");
  const [zone, setZone] = useState<string>("Central Zone");
  const [severity, setSeverity] = useState<string>("High");
  const [description, setDescription] = useState("");
  const [citizenName, setCitizenName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [conflicting, setConflicting] = useState("no");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const issueTypes = CATEGORY_ISSUE_TYPES[category] || [];

  function onCategoryChange(c: string) {
    setCategory(c);
    const first = CATEGORY_ISSUE_TYPES[c]?.[0] || "";
    setIssueType(first);
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Fallback to municipal center
      setLat("28.6139");
      setLon("77.2090");
      toast.info("Using simulated municipal centre (geolocation unavailable)");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLon(pos.coords.longitude.toFixed(5));
        toast.success("Location captured");
      },
      () => {
        setLat("28.6139");
        setLon("77.2090");
        toast.info("Using simulated municipal centre");
      },
      { timeout: 4000 }
    );
  }

  async function submit() {
    if (!category || !issueType || !severity) {
      toast.error("Please fill in category, issue type and severity");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const payload: any = {
        category,
        issueType,
        zone,
        citizenSeverity: severity,
        description,
        citizenName: citizenName || "Anonymous Citizen",
        conflictingEvidence: conflicting,
      };
      if (lat && lon) {
        payload.latitude = parseFloat(lat);
        payload.longitude = parseFloat(lon);
      }
      const res = await api<{ reportId: string; incidentId: string; verificationStatus: string; message: string }>(
        "/api/reports",
        { method: "POST", body: JSON.stringify(payload) }
      );
      setResult(res);
      toast.success("Report submitted successfully");
      setDescription("");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="cv-hero-gradient border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Report a Municipal Issue
        </CardTitle>
        <CardDescription>
          Submit a crowd-sourced report about Roads, Street Lighting, or Waste.
          The verification engine will correlate it with nearby reports and
          compute a confidence score automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-semibold">Category</Label>
            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Issue type</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {issueTypes.map((t) => (
                  <SelectItem key={t} value={t}>{ISSUE_TYPE_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Description</Label>
          <Textarea
            placeholder="Describe what you observed (e.g. 'large pothole near the bus stop damaging two-wheelers')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label className="text-xs font-semibold">Your name</Label>
            <Input
              placeholder="Anonymous Citizen"
              value={citizenName}
              onChange={(e) => setCitizenName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Latitude</Label>
            <Input
              placeholder="28.6139"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Longitude</Label>
            <Input
              placeholder="77.2090"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={useMyLocation}>
            <Crosshair className="mr-1 h-3.5 w-3.5" />
            Use my location
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLat("");
              setLon("");
            }}
          >
            <MapPin className="mr-1 h-3.5 w-3.5" />
            Omit location (demo: missing GPS)
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs font-semibold">Conflicting evidence?</Label>
            <Select value={conflicting} onValueChange={setConflicting}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no" className="text-xs">No</SelectItem>
                <SelectItem value="yes" className="text-xs">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!lat || !lon ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No GPS coordinates provided. The system will flag this as{" "}
              <span className="font-semibold">MISSING_LOCATION</span> and reduce confidence by 30 points.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950/40">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Location captured — the report can be spatially correlated with nearby reports.</span>
          </div>
        )}

        <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Submit report
        </Button>

        {result && (
          <div className="rounded-lg border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">{result.message}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">Report: {result.reportId}</Badge>
              <Badge variant="outline" className="font-mono">Incident: {result.incidentId}</Badge>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                Status: {result.verificationStatus}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The verification engine has correlated your report with nearby
              reports and computed an initial confidence score. Officers can now
              review it in the operations dashboard.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
