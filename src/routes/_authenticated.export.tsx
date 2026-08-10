import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({
    meta: [
      { title: "Export My Data — HVAC Pro" },
      { name: "description", content: "Download your bookings, orders, reviews, and saved data as CSV files anytime." },
    ],
  }),
  component: ExportPage,
});

type Dataset = {
  key: string;
  label: string;
  description: string;
  fetch: (userId: string) => Promise<Record<string, unknown>[]>;
};

const DATASETS: Dataset[] = [
  {
    key: "bookings",
    label: "Bookings",
    description: "Every service booking you've scheduled",
    fetch: async (userId) => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },
  {
    key: "orders",
    label: "Orders",
    description: "Product orders placed on the shop",
    fetch: async (userId) => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },
  {
    key: "order_items",
    label: "Order line items",
    description: "Individual products from your orders",
    fetch: async (userId) => {
      const { data: orders, error: oErr } = await supabase
        .from("orders").select("id").eq("user_id", userId);
      if (oErr) throw oErr;
      const ids = (orders ?? []).map((o) => o.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("order_items").select("*").in("order_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Reviews you've submitted",
    fetch: async (userId) => {
      const { data, error } = await supabase
        .from("reviews").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },
  {
    key: "saved_addresses",
    label: "Saved addresses",
    description: "Your saved service addresses",
    fetch: async (userId) => {
      const { data, error } = await supabase
        .from("saved_addresses").select("*").eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  },
  {
    key: "quote_leads",
    label: "Quote requests",
    description: "Instant-quote requests you've submitted",
    fetch: async (userId) => {
      const { data, error } = await supabase
        .from("quote_leads").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function ExportPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(DATASETS.map((d) => d.key)),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const exportOne = async (ds: Dataset) => {
    if (!user) return;
    setBusy(ds.key);
    try {
      const rows = await ds.fetch(user.id);
      if (rows.length === 0) {
        toast.info(`No ${ds.label.toLowerCase()} to export`);
        return;
      }
      download(`${ds.key}-${stamp()}.csv`, toCSV(rows));
      toast.success(`Exported ${rows.length} ${ds.label.toLowerCase()}`);
    } catch (e) {
      toast.error(`Failed to export ${ds.label}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportSelectedAsJSON = async () => {
    if (!user) return;
    setBusyBulk(true);
    try {
      const chosen = DATASETS.filter((d) => selected.has(d.key));
      const bundle: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
      };
      let total = 0;
      for (const ds of chosen) {
        const rows = await ds.fetch(user.id);
        bundle[ds.key] = rows;
        total += rows.length;
      }
      download(
        `my-data-${stamp()}.json`,
        JSON.stringify(bundle, null, 2),
        "application/json",
      );
      toast.success(`Exported ${total} record${total === 1 ? "" : "s"} across ${chosen.length} table${chosen.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(`Bulk export failed: ${(e as Error).message}`);
    } finally {
      setBusyBulk(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export my data</h1>
        <p className="text-muted-foreground mt-1">
          Download a copy of your account data as CSV or a single JSON bundle. Only records you own are included.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {DATASETS.map((ds) => (
              <label key={ds.key} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/40 transition">
                <Checkbox
                  checked={selected.has(ds.key)}
                  onCheckedChange={() => toggle(ds.key)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{ds.label}</p>
                  <p className="text-sm text-muted-foreground">{ds.description}</p>
                </div>
              </label>
            ))}
          </div>
          <Button
            onClick={exportSelectedAsJSON}
            disabled={busyBulk || selected.size === 0}
            className="w-full sm:w-auto"
          >
            {busyBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export selected as JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Individual CSV downloads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DATASETS.map((ds) => (
            <div key={ds.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium">{ds.label}</p>
                <p className="text-sm text-muted-foreground truncate">{ds.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportOne(ds)}
                disabled={busy === ds.key}
              >
                {busy === ds.key ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                CSV
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Data is fetched securely from Lovable Cloud under your account. Row-level security ensures you can only export records you own.
      </p>
    </div>
  );
}
