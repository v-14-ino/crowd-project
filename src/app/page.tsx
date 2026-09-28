"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, timeAgo } from "@/lib/api-client";
import {
  CATEGORY_OPTIONS,
  ISSUE_TYPE_LABELS,
  type Incident,
  type IncidentStats,
  type Role,
} from "@/lib/types";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { IncidentQueue } from "@/components/dashboard/incident-queue";
import { IncidentDrilldown } from "@/components/dashboard/incident-drilldown";
import { IncidentMap } from "@/components/dashboard/incident-map";
import { ReportForm } from "@/components/dashboard/report-form";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import {
  StatusBadge,
  FreshnessBadge,
  CategoryBadge,
  PriorityBadge,
} from "@/components/dashboard/badges";
import {
  ShieldCheck,
  Users,
  User,
  BarChart3,
  Database,
  Send,
  LayoutDashboard,
  Search,
  RefreshCw,
  Activity,
  Flame,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_FILTERS: Record<string, string> = {
  search: "",
  category: "All",
  priorityLevel: "All",
  confidenceLevel: "All",
  status: "All",
  freshness: "All",
  zone: "All",
};

const ROLE_INFO: Record<Role, { label: string; icon: React.ReactNode; desc: string }> = {
  citizen: { label: "Citizen", icon: <User className="h-3.5 w-3.5" />, desc: "Submit reports & track them" },
  officer: { label: "Verification Officer", icon: <ShieldCheck className="h-3.5 w-3.5" />, desc: "Review, verify, handle conflicts" },
  coordinator: { label: "Coordinator", icon: <Users className="h-3.5 w-3.5" />, desc: "Municipality-wide oversight" },
  admin: { label: "Admin", icon: <BarChart3 className="h-3.5 w-3.5" />, desc: "System, seed & metrics" },
};

type Tab = "dashboard" | "report" | "track" | "metrics" | "admin";

const ROLE_TABS: Record<Role, Tab[]> = {
  citizen: ["report", "track"],
  officer: ["dashboard", "track"],
  coordinator: ["dashboard", "metrics"],
  admin: ["dashboard", "report", "track", "metrics", "admin"],
};

export default function Page() {
  const [role, setRole] = useState<Role>("coordinator");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [trackQuery, setTrackQuery] = useState("");
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await api<IncidentStats>("/api/incidents/stats");
      setStats(s);
      if (s.totalIncidents === 0) setNeedsSeed(true);
      else setNeedsSeed(false);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== "All") params.set(k, v);
      });
      const data = await api<Incident[]>(`/api/incidents?${params.toString()}`);
      setIncidents(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLastSync(new Date());
    }
  }, [filters]);

  const loadRecent = useCallback(async () => {
    try {
      const data = await api<any[]>("/api/reports/recent?limit=10");
      setRecentReports(data);
    } catch {
      setRecentReports([]);
    }
  }, []);

  const loadAll = useCallback(
    async (poll = false) => {
      if (!poll) setLoading(true);
      await Promise.all([loadStats(), loadIncidents(), loadRecent()]).catch(() => {});
      if (!poll) setLoading(false);
    },
    [loadStats, loadIncidents, loadRecent]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-poll every 15s
  useEffect(() => {
    const t = setInterval(() => loadAll(true), 15000);
    return () => clearInterval(t);
  }, [loadAll]);

  // Keep tab valid for role
  useEffect(() => {
    const tabs = ROLE_TABS[role];
    if (!tabs.includes(tab)) setTab(tabs[0]);
  }, [role, tab]);

  async function switchRole(r: Role) {
    setRole(r);
    await api("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ role: r }),
    }).catch(() => {});
  }

  async function runSeed() {
    setSeeding(true);
    try {
      await api("/api/seed", { method: "POST" });
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }

  function handleSelect(inc: Incident) {
    setSelected(inc);
    setDrawerOpen(true);
  }

  function handleFilterChange(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function handleKpiClick(filterType: string, filterVal: string) {
    if (filterType === "all") {
      setFilters(DEFAULT_FILTERS);
    } else {
      setFilters({ ...DEFAULT_FILTERS, [filterType]: filterVal });
    }
  }

  async function trackReport() {
    setTrackError(null);
    setTrackResult(null);
    if (!trackQuery.trim()) return;
    try {
      const q = trackQuery.trim();
      let res: any;
      if (q.toUpperCase().startsWith("INC-")) {
        res = await api(`/api/incidents/${q}`);
      } else {
        res = await api(`/api/reports/${q}`);
      }
      setTrackResult(res);
    } catch (e: any) {
      setTrackError(`No report or incident found for "${trackQuery}".`);
    }
  }

  const highPriorityIncidents = useMemo(
    () =>
      incidents.filter(
        (i) =>
          (i.priorityLevel === "Critical" || i.priorityLevel === "High") &&
          ["Verified", "Corroborated", "Pending"].includes(i.status)
      ),
    [incidents]
  );

  const availableTabs = ROLE_TABS[role];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight sm:text-base">
                Municipal Crowd Verification
              </h1>
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                Roads · Street Lighting · Waste — Decision Support Dashboard
              </p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:ml-4 sm:w-auto">
            {availableTabs.map((t) => (
              <TabButton
                key={t}
                active={tab === t}
                onClick={() => setTab(t)}
                icon={TAB_ICON[t]}
                label={TAB_LABEL[t]}
              />
            ))}
          </nav>

          {/* Role switcher */}
          <div className="order-2 ml-auto flex items-center gap-1.5 sm:order-3">
            <span className="hidden text-[10px] text-muted-foreground md:inline">View as</span>
            <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
              {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    role === r
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ROLE_INFO[r].desc}
                >
                  {ROLE_INFO[r].icon}
                  <span className="hidden sm:inline">{ROLE_INFO[r].label}</span>
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => loadAll(false)}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {/* live status bar */}
        <div className="border-t bg-muted/30">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="cv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              LIVE · synced {timeAgo(lastSync)}
            </span>
            <span>
              Role: <span className="font-medium text-foreground">{ROLE_INFO[role].label}</span>
            </span>
            {stats && (
              <span>
                {stats.totalIncidents} incidents · {stats.verifiedIncidents} verified ·{" "}
                {stats.criticalIncidents + stats.highPriorityIncidents} high priority
              </span>
            )}
            {needsSeed && (
              <button
                onClick={runSeed}
                className="ml-auto inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white"
              >
                {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                Seed demo data
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {tab === "dashboard" && (
          <DashboardView
            role={role}
            stats={stats}
            incidents={incidents}
            filters={filters}
            loading={loading}
            error={error}
            onFilterChange={handleFilterChange}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            onKpiClick={handleKpiClick}
            onSelect={handleSelect}
            recentReports={recentReports}
            highPriorityIncidents={highPriorityIncidents}
          />
        )}

        {tab === "report" && <ReportForm onChanged={() => loadAll(true)} />}

        {tab === "track" && (
          <TrackView
            query={trackQuery}
            setQuery={setTrackQuery}
            onTrack={trackReport}
            result={trackResult}
            error={trackError}
          />
        )}

        {tab === "metrics" && <MetricsPanel onSeed={runSeed} />}

        {tab === "admin" && (
          <AdminView onSeed={runSeed} seeding={seeding} stats={stats} onRefresh={() => loadAll(false)} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto max-w-[1600px] px-4 py-3 text-center text-[11px] text-muted-foreground">
          Crowd-Report Verification & Confidence Dashboard · Municipal Decision Support ·
          Verification Engine + Spatial Correlation + Explainable Confidence ·{" "}
          <span className="font-medium text-foreground">Reproducible Simulated Experiment</span>
        </div>
      </footer>

      {/* Drill-down */}
      <IncidentDrilldown
        incidentId={selected?.incidentId ?? null}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={() => loadAll(true)}
        responderName={role === "officer" ? "Officer Desai" : ROLE_INFO[role].label}
      />
    </div>
  );
}

const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Dashboard",
  report: "Report Issue",
  track: "Track Report",
  metrics: "Metrics",
  admin: "Admin",
};
const TAB_ICON: Record<Tab, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-3.5 w-3.5" />,
  report: <Send className="h-3.5 w-3.5" />,
  track: <Search className="h-3.5 w-3.5" />,
  metrics: <BarChart3 className="h-3.5 w-3.5" />,
  admin: <Database className="h-3.5 w-3.5" />,
};

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DashboardView({
  role,
  stats,
  incidents,
  filters,
  loading,
  error,
  onFilterChange,
  onReset,
  onKpiClick,
  onSelect,
  recentReports,
  highPriorityIncidents,
}: {
  role: Role;
  stats: IncidentStats | null;
  incidents: Incident[];
  filters: Record<string, string>;
  loading: boolean;
  error: string | null;
  onFilterChange: (f: string, v: string) => void;
  onReset: () => void;
  onKpiClick: (t: string, v: string) => void;
  onSelect: (i: Incident) => void;
  recentReports: any[];
  highPriorityIncidents: Incident[];
}) {
  return (
    <div className="space-y-4">
      {/* Hero / KPIs */}
      <section className="cv-hero-gradient rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold sm:text-xl">
              {role === "coordinator"
                ? "Municipality Operations Overview"
                : "Officer Operations & Verification Center"}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Real-time decision support — prioritised by severity, crowd corroboration,
              freshness and responder verification.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="mr-1 h-3 w-3" />
            Explainable verification engine
          </Badge>
        </div>
        <KpiCards stats={stats} activeFilter={filters} onCardClick={onKpiClick} />
      </section>

      {/* High-priority surfacing band */}
      {highPriorityIncidents.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:bg-red-950/20">
          <div className="mb-2 flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
              High-Priority Queue — {highPriorityIncidents.length} incidents need attention
            </h3>
          </div>
          <div className="cv-scroll flex gap-2 overflow-x-auto pb-1">
            {highPriorityIncidents.slice(0, 12).map((inc) => (
              <button
                key={inc.id}
                onClick={() => onSelect(inc)}
                className="min-w-[220px] shrink-0 rounded-md border bg-card p-2.5 text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <CategoryBadge category={inc.category} issueType={inc.issueType} />
                  <PriorityBadge level={inc.priorityLevel} score={inc.priorityScore} />
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{inc.incidentId}</span>
                  <span>· {inc.zone}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <StatusBadge status={inc.status} />
                  <FreshnessBadge freshness={inc.freshnessStatus} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {inc.lastReportedTime ? `Reported ${timeAgo(inc.lastReportedTime)}` : "—"} ·
                  {" "}{inc.independentReportsCount} independent reports
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent reports */}
      <section className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Recent Citizen Reports (live feed)</h3>
        </div>
        <div className="cv-scroll flex gap-2 overflow-x-auto pb-1">
          {recentReports.length === 0 && (
            <p className="text-xs text-muted-foreground">No recent reports.</p>
          )}
          {recentReports.map((r) => (
            <div
              key={r.reportId}
              className="min-w-[240px] shrink-0 rounded-md border bg-muted/30 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <CategoryBadge category={r.category} issueType={r.issueType} />
                <Badge variant="outline" className="text-[10px]">{r.citizenSeverity}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{r.description}</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">{r.reportId}</span>
                <span>{timeAgo(r.reportedTime)}</span>
              </div>
              {r.incidentId && (
                <div className="mt-1 text-[10px]">
                  <span className="text-muted-foreground">→ </span>
                  <span className="font-mono">{r.incidentId}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Filters + queue + map */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onReset}
        totalCount={stats?.totalIncidents || incidents.length}
        filteredCount={incidents.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <IncidentQueue
            incidents={incidents}
            loading={loading}
            error={error}
            onSelect={onSelect}
          />
        </div>
        <div className="lg:col-span-2">
          <IncidentMap incidents={incidents} loading={loading} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

function TrackView({
  query,
  setQuery,
  onTrack,
  result,
  error,
}: {
  query: string;
  setQuery: (s: string) => void;
  onTrack: () => void;
  result: any;
  error: string | null;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" />
            Track a Report or Incident
          </CardTitle>
          <CardDescription className="text-xs">
            Enter a Report ID (RPT-...) or Incident ID (INC-...) to check its status,
            confidence score, and verification decision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. RPT-AB12CD34EF56 or INC-..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onTrack()}
            />
            <Button onClick={onTrack}>
              <Search className="mr-1 h-4 w-4" />
              Track
            </Button>
          </div>
          {error && (
            <p className="mt-3 rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30">{error}</p>
          )}
          {result && (
            <div className="mt-4 space-y-3 rounded-lg border bg-card p-4">
              {result.incidentId ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={result.category} issueType={result.issueType} />
                    <Badge variant="outline" className="font-mono text-[10px]">{result.incidentId}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Metric label="Status" value={result.verificationStatus || result.status || "Pending"} />
                    <Metric label="Confidence" value={`${result.confidenceScore ?? "—"}/${100}`} />
                    <Metric label="Priority" value={`${result.priorityScore ?? "—"}`} />
                    <Metric label="Level" value={result.priorityLevel || "—"} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Description:</span> {result.description}</p>
                    <p><span className="font-medium text-foreground">Zone:</span> {result.zone || "—"}</p>
                    <p><span className="font-medium text-foreground">Reported:</span> {timeAgo(result.reportedTime || result.createdAt)}</p>
                    {result.latitude != null && (
                      <p><span className="font-medium text-foreground">Location:</span> {result.latitude.toFixed(4)}, {result.longitude?.toFixed(4)}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={result.category} issueType={result.issueType} />
                    <Badge variant="outline" className="font-mono text-[10px]">{result.reportId}</Badge>
                  </div>
                  <p className="text-xs">
                    Status: <span className="font-semibold">{result.verificationStatus || "Awaiting incident assignment"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{result.description}</p>
                  <p className="text-[10px] text-muted-foreground">Reported {timeAgo(result.reportedTime)}</p>
                  {!result.incidentId && (
                    <p className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-950/30">
                      This report has not yet been grouped into an incident. It will be
                      correlated with nearby reports automatically.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AdminView({
  onSeed,
  seeding,
  stats,
  onRefresh,
}: {
  onSeed: () => void;
  seeding: boolean;
  stats: IncidentStats | null;
  onRefresh: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            System Administration
          </CardTitle>
          <CardDescription>
            Manage the reproducible simulated experiment and inspect system state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">Reproducible Simulated Experiment</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Seeds {16} scenarios covering: high-priority incidents, duplicate spam,
              stale reports, missing location, conflicting evidence, missing evidence,
              and responder-rejected false alarms — across Roads, Street Lighting and Waste.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={onSeed} disabled={seeding}>
                {seeding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Database className="mr-1 h-4 w-4" />}
                {seeding ? "Seeding..." : "Re-seed experiment"}
              </Button>
              <Button variant="outline" onClick={onRefresh}>
                <RefreshCw className="mr-1 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
          {stats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Total" value={String(stats.totalIncidents)} />
              <Metric label="Verified" value={String(stats.verifiedIncidents)} />
              <Metric label="Critical" value={String(stats.criticalIncidents)} />
              <Metric label="Stale" value={String(stats.staleIncidents)} />
            </div>
          )}
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo accounts (role-based)</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              <li>citizen@demo.in — Citizen (submit & track reports)</li>
              <li>officer@demo.in — Verification Officer (review, verify, reject)</li>
              <li>coordinator@demo.in — Coordinator (municipality-wide oversight + metrics)</li>
              <li>admin@demo.in — Admin (system + seed + all views)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
