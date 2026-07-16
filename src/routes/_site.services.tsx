import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_site/services")({
  head: () => ({
    meta: [
      { title: "HVAC Services — Repair, Installation, Maintenance | HVAC Pro" },
      { name: "description", content: "Complete HVAC services: AC repair, furnace repair, new system installation, duct cleaning, indoor air quality, and 24/7 emergency service." },
      { property: "og:title", content: "HVAC Services | HVAC Pro" },
      { property: "og:description", content: "Full-service heating, cooling, and air quality across the US." },
    ],
  }),
  component: ServicesPage,
});

type Row = {
  slug: string; name: string; short: string;
  starting_at: number; icon: string; bullets: string[];
};

function ServicesPage() {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("slug,name,short,starting_at,icon,bullets")
        .eq("published", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        bullets: Array.isArray(r.bullets) ? r.bullets as string[] : [],
      })) as Row[];
    },
  });

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

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link key={s.slug} to="/services/$slug" params={{ slug: s.slug }} className="group">
                <Card className="h-full transition-all hover:-translate-y-1 hover:shadow-elevated">
                  <CardContent className="p-6">
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg gradient-cool text-primary-foreground">
                      <DynamicIcon name={s.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{s.name}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{s.short}</p>
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {s.bullets.slice(0, 3).map((b) => (
                        <li key={b} className="flex items-start gap-2 text-muted-foreground">
                          <span className="mt-1.5 inline-block h-1 w-1 rounded-full bg-primary" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Starting at <span className="font-semibold text-foreground">{formatMoney(Number(s.starting_at))}</span></span>
                      <span className="font-semibold text-primary group-hover:underline">View →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
