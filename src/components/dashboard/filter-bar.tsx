"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw, Search } from "lucide-react";
import { CATEGORY_OPTIONS, ZONES, SEVERITY_OPTIONS } from "@/lib/types";
import { SavedFilters } from "@/components/dashboard/saved-filters";

interface FilterBarProps {
  filters: Record<string, string>;
  onFilterChange: (field: string, value: string) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

const STATUSES = ["All", "Verified", "Corroborated", "Pending", "Conflicted", "Rejected", "Unknown"];
const PRIORITY_LEVELS = ["All", "Critical", "High", "Medium", "Low"];
const CONFIDENCE_LEVELS = ["All", "High", "Medium", "Low"];
const FRESHNESS = ["All", "Fresh", "Aging", "Stale"];

export function FilterBar({
  filters,
  onFilterChange,
  onReset,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search incident id, category, zone..."
              value={filters.search || ""}
              onChange={(e) => onFilterChange("search", e.target.value)}
              className="pl-8"
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredCount}</span> of{" "}
            <span className="font-semibold text-foreground">{totalCount}</span> incidents
          </span>
          <SavedFilters currentFilters={filters} onLoad={(f) => Object.entries(f).forEach(([k, v]) => onFilterChange(k, v))} />
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SelectField
            label="Category"
            value={filters.category || "All"}
            options={["All", ...CATEGORY_OPTIONS]}
            onChange={(v) => onFilterChange("category", v)}
          />
          <SelectField
            label="Status"
            value={filters.status || "All"}
            options={STATUSES}
            onChange={(v) => onFilterChange("status", v)}
          />
          <SelectField
            label="Priority"
            value={filters.priorityLevel || "All"}
            options={PRIORITY_LEVELS}
            onChange={(v) => onFilterChange("priorityLevel", v)}
          />
          <SelectField
            label="Confidence"
            value={filters.confidenceLevel || "All"}
            options={CONFIDENCE_LEVELS}
            onChange={(v) => onFilterChange("confidenceLevel", v)}
          />
          <SelectField
            label="Freshness"
            value={filters.freshness || "All"}
            options={FRESHNESS}
            onChange={(v) => onFilterChange("freshness", v)}
          />
          <SelectField
            label="Zone"
            value={filters.zone || "All"}
            options={["All", ...ZONES]}
            onChange={(v) => onFilterChange("zone", v)}
          />
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { SEVERITY_OPTIONS };
