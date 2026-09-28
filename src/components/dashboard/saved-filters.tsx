"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Bookmark, Trash2, Plus, Check } from "lucide-react";

interface Preset {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

interface Props {
  currentFilters: Record<string, string>;
  onLoad: (filters: Record<string, string>) => void;
}

export function SavedFilters({ currentFilters, onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPresets() {
    try {
      const data = await api<Preset[]>("/api/filter-presets");
      setPresets(data);
    } catch {
      setPresets([]);
    }
  }

  useEffect(() => {
    if (open) loadPresets();
  }, [open]);

  async function savePreset() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api("/api/filter-presets", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), filters: currentFilters }),
      });
      toast.success(`Preset "${newName.trim()}" saved`);
      setNewName("");
      await loadPresets();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deletePreset(id: string) {
    try {
      await api(`/api/filter-presets?id=${id}`, { method: "DELETE" });
      toast.success("Preset deleted");
      await loadPresets();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function applyPreset(p: Preset) {
    onLoad(p.filters);
    setOpen(false);
    toast.success(`Loaded preset "${p.name}"`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          Presets
          {presets.length > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/10 px-1 text-[9px] font-bold text-primary">
              {presets.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Bookmark className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">Saved filter presets</span>
        </div>

        {/* Save current */}
        <div className="mb-3 flex gap-1.5">
          <Input
            placeholder="Preset name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={savePreset}
            disabled={loading || !newName.trim()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* List */}
        {presets.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            No saved presets yet. Configure filters above and save them for
            quick recall.
          </p>
        ) : (
          <ul className="cv-scroll max-h-48 space-y-1 overflow-y-auto">
            {presets.map((p) => {
              const filterSummary = Object.entries(p.filters)
                .filter(([k, v]) => v && v !== "All")
                .map(([k, v]) => `${k}=${v}`)
                .join(", ");
              return (
                <li
                  key={p.id}
                  className="group flex items-center gap-1 rounded-md border bg-muted/20 px-2 py-1.5 transition-colors hover:bg-muted/40"
                >
                  <button
                    onClick={() => applyPreset(p)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600 opacity-0 group-hover:opacity-100" />
                      <span className="text-xs font-medium">{p.name}</span>
                    </div>
                    {filterSummary && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {filterSummary}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={() => deletePreset(p.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                    title="Delete preset"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
