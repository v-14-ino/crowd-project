"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api-client";
import {
  Boxes,
  PieChart as PieIcon,
  TrendingUp,
  Gauge,
  Clock,
  MapPin,
  Activity,
  Calendar,
} from "lucide-react";

interface Analytics {
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byFreshness: Record<string, number>;
  byZone: Record<string, number>;
  byConfidenceBucket: Record<string, number>;
  avgConfByCategory: Record<string, { avg: number; count: number }>;
  trend: { date: string; count: number }[];
  evidenceCoverage: {
    withEvidence: number;
    withoutEvidence: number;
    withResponder: number;
    withoutResponder: number;
  };
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  Verified: "#10b981",
  Corroborated: "#14b8a6",
  Pending: "#f59e0b",
  Conflicted: "#e11d48",
  Rejected: "#9f1239",
  Unknown: "#71717a",
};
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#71717a",
};
const FRESHNESS_COLORS: Record<string, string> = {
  Fresh: "#10b981",
  Aging: "#f59e0b",
  Stale: "#e11d48",
};
const CATEGORY_COLORS = ["#0d9488", "#7c3aed", "#65a30d"];

export function AnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    let active = true;
    api<Analytics>(`/api/analytics?days=${days}`)
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-rose-600">
          {error || "Unable to load analytics"}
        </CardContent>
      </Card>
    );
  }

  const categoryData = Object.entries(data.byCategory).map(([name, value]) => ({
    name,
    value,
    avg: data.avgConfByCategory[name]?.avg ?? 0,
  }));
  const statusData = Object.entries(data.byStatus).map(([name, value]) => ({
    name,
    value,
    fill: STATUS_COLORS[name] || "#71717a",
  }));
  const priorityData = Object.entries(data.byPriority).map(([name, value]) => ({
    name,
    value,
    fill: PRIORITY_COLORS[name] || "#71717a",
  }));
  const freshnessData = Object.entries(data.byFreshness).map(([name, value]) => ({
    name,
    value,
    fill: FRESHNESS_COLORS[name] || "#71717a",
  }));
  const zoneData = Object.entries(data.byZone)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const trendData = data.trend.map((t) => ({
    ...t,
    label: t.date.slice(5),
  }));

  return (
    <div className="space-y-4">
      {/* Date-range selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Trend window</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
          {[7, 14, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "ghost"}
              className={`h-7 px-3 text-xs ${days === d ? "shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setDays(d)}
            >
              {d} days
            </Button>
          ))}
        </div>
      </div>

      {/* Trend + category */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              Incident Trend ({days} days)
            </CardTitle>
            <CardDescription className="text-xs">
              Reports received per day over the past {days} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0d9488"
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                  name="Incidents"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Boxes className="h-4 w-4 text-primary" />
              Reports by Category
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution across Roads, Street Lighting, Waste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Incidents">
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status + Priority + Freshness pies */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard title="Verification Status" icon={<PieIcon className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={40}
                paddingAngle={2}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Distribution" icon={<Gauge className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {priorityData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Freshness Mix" icon={<Clock className="h-4 w-4 text-primary" />}>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              data={freshnessData}
              innerRadius="35%"
              outerRadius="100%"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar background dataKey="value">
                {freshnessData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </RadialBar>
              <Legend
                iconSize={8}
                layout="horizontal"
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Zone + evidence coverage */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              Incidents by Zone
            </CardTitle>
            <CardDescription className="text-xs">
              Geographic distribution across municipal zones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={zoneData} margin={{ top: 4, right: 8, bottom: 30, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="#0d9488" radius={[6, 6, 0, 0]} name="Incidents" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              Evidence & Responder Coverage
            </CardTitle>
            <CardDescription className="text-xs">
              How many incidents have supporting data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <CoverageRing
                label="With evidence"
                value={data.evidenceCoverage.withEvidence}
                total={data.total}
                color="#10b981"
              />
              <CoverageRing
                label="Without evidence"
                value={data.evidenceCoverage.withoutEvidence}
                total={data.total}
                color="#f59e0b"
              />
              <CoverageRing
                label="Responder verified"
                value={data.evidenceCoverage.withResponder}
                total={data.total}
                color="#14b8a6"
              />
              <CoverageRing
                label="No responder yet"
                value={data.evidenceCoverage.withoutResponder}
                total={data.total}
                color="#71717a"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CoverageRing({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-muted/20 p-3">
      <div className="relative h-20 w-20">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/40"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <p className="text-center text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
        <br />
        <span className="text-foreground">{value}/{total}</span>
      </p>
    </div>
  );
}
