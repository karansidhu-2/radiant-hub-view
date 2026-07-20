import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, Star, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_site/services")({
  head: () => ({
    meta: [
      { title: "HVAC Services — Repair, Installation, Maintenance | HVAC Pro" },
      { name: "description", content: "Complete HVAC services: AC repair, furnace repair, new system installation, duct cleaning, indoor air quality, and 24/7 emergency service." },
      { property: "og:title", content: "HVAC Services | HVAC Pro" },
      { property: "og:description", content: "Full-service heating, cooling, and air quality across the US." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/services" },
    ],
    links: [{ rel: "canonical", href: "https://radiant-hub-view.lovable.app/services" }],
  }),
  component: ServicesPage,
});

type Row = {
  slug: string; name: string; short: string; category: string;
  starting_at: number; icon: string; bullets: string[];
};

type RatingRow = { service_slug: string; avg: number; count: number };

// Human-labeled category groups. Everything else falls into "Other".
const CATEGORY_TABS: { key: string; label: string; match: (c: string) => boolean }[] = [
  { key: "all", label: "All services", match: () => true },
  { key: "repair", label: "Repair", match: (c) => c === "cooling" || c === "heating" || c === "repair" },
  { key: "install", label: "Install", match: (c) => c === "install" },
  { key: "maintenance", label: "Maintenance", match: (c) => c === "maintenance" },
  { key: "air", label: "Air quality", match: (c) => c === "air-quality" },
  { key: "emergency", label: "Emergency", match: (c) => c === "emergency" },
];

function ServicesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("all");

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("slug,name,short,starting_at,icon,bullets,category")
        .eq("published", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        bullets: Array.isArray(r.bullets) ? (r.bullets as string[]) : [],
        category: r.category ?? "",
      })) as Row[];
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // Aggregate rating + count per service from published reviews. One query,
  // grouped client-side — reviews volume is small and cached for 5 minutes.
  const { data: ratings = {} } = useQuery({
    queryKey: ["services", "ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("service_slug,rating")
        .eq("published", true)
        .not("service_slug", "is", null);
      if (error) throw error;
      const acc: Record<string, RatingRow> = {};
      for (const r of (data ?? []) as { service_slug: string; rating: number }[]) {
        const cur = acc[r.service_slug] ?? { service_slug: r.service_slug, avg: 0, count: 0 };
        cur.avg = (cur.avg * cur.count + Number(r.rating || 0)) / (cur.count + 1);
        cur.count += 1;
        acc[r.service_slug] = cur;
      }
      return acc;
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const filtered = useMemo(() => {
    const tabDef = CATEGORY_TABS.find((t) => t.key === tab) ?? CATEGORY_TABS[0];
    return services.filter((s) => tabDef.match(s.category));
  }, [services, tab]);

  // Highlight the single most-reviewed service as "Popular" (skip emergency).
  const popularSlug = useMemo(() => {
    let best: { slug: string; count: number } | null = null;
    for (const s of services) {
      if (s.category === "emergency") continue;
      const c = ratings[s.slug]?.count ?? 0;
      if (!best || c > best.count) best = { slug: s.slug, count: c };
    }
    return best && best.count > 0 ? best.slug : null;
  }, [services, ratings]);

  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Services</p>
          <h1 className="mt-1 text-3xl font-bold md:text-5xl">Everything your home comfort system needs</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Book any service online in under 2 minutes. Same-day availability in most metro areas. All work performed by our own W-2 certified technicians — never subcontracted.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        {/* Category filter chips — horizontal scroll on mobile, wrap on desktop */}
        <div
          role="tablist"
          aria-label="Filter services by category"
          className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORY_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`snap-start whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                  active
                    ? "border-primary/40 gradient-cool text-primary-foreground shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
            No services in this category yet. Try another filter.
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => {
              const rating = ratings[s.slug];
              const isEmergency = s.category === "emergency";
              const isPopular = s.slug === popularSlug;
              return (
                <Card key={s.slug} className="card-pop relative flex h-full flex-col overflow-hidden hover:border-primary/35">
                  {/* Corner ribbon: live availability for emergency, popular otherwise */}
                  {isEmergency ? (
                    <span className="absolute right-0 top-0 flex items-center gap-1.5 rounded-bl-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      Available now
                    </span>
                  ) : isPopular ? (
                    <span className="absolute right-3 top-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Popular
                    </span>
                  ) : null}

                  <CardContent className="flex h-full flex-col p-6">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg gradient-cool text-primary-foreground">
                        <DynamicIcon name={s.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {rating && rating.count > 0 ? (
                          <div className="mb-0.5 flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-bold text-foreground">{rating.avg.toFixed(1)}</span>
                            <span className="text-[11px] text-muted-foreground">
                              ({rating.count} review{rating.count === 1 ? "" : "s"})
                            </span>
                          </div>
                        ) : (
                          <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Certified techs
                          </div>
                        )}
                        <h3 className="truncate text-lg font-semibold">
                          <Link to="/services/$slug" params={{ slug: s.slug }} className="hover:underline">
                            {s.name}
                          </Link>
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{s.short}</p>

                    <ul className="mt-4 space-y-1.5 text-sm">
                      {s.bullets.slice(0, 3).map((b) => (
                        <li key={b} className="flex items-start gap-2 text-muted-foreground">
                          <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      <div className="mb-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Starting at</span>
                        <span className="text-lg font-extrabold text-foreground">
                          {formatMoney(Number(s.starting_at))}
                        </span>
                      </div>
                      <Button
                        type="button"
                        className="w-full gradient-cool text-primary-foreground"
                        onClick={() => navigate({ to: "/book", search: { service: s.slug } })}
                        aria-label={`Book ${s.name}`}
                      >
                        Book this service <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Free-estimate / callback strip — sits under the grid on every device */}
        <FreeEstimateStrip />

        {/* Trust chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <TrustChip label="Licensed & insured" />
          <TrustChip label="EPA 608 certified" />
          <TrustChip label="Locally owned" />
          <TrustChip label="1-year labor warranty" />
        </div>
      </section>
    </>
  );
}

function FreeEstimateStrip() {
  return (
    <div className="mt-10 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Not sure what you need?
            </p>
            <p className="text-sm font-bold text-foreground sm:text-base">
              Get a free estimate — a tech will call you back within the hour.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/contact">Request callback</Link>
          </Button>
          <Button asChild className="w-full gradient-cool text-primary-foreground sm:w-auto">
            <a href="tel:+18005550199">
              <PhoneCall className="mr-1 h-4 w-4" /> Call us now
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrustChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}
