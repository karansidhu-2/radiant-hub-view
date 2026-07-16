import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_site/services/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — HVAC Pro` },
      { property: "og:title", content: `HVAC Service — HVAC Pro` },
    ],
  }),
  errorComponent: ({ error }) => <div role="alert" className="p-10 text-center">{error.message}</div>,
  component: ServiceDetail,
});

type Svc = {
  slug: string; name: string; short: string; description: string;
  starting_at: number; icon: string; bullets: string[];
};

function ServiceDetail() {
  const { slug } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["service", slug],
    queryFn: async () => {
      const [main, others] = await Promise.all([
        supabase.from("services")
          .select("slug,name,short,description,starting_at,icon,bullets")
          .eq("slug", slug).eq("published", true).maybeSingle(),
        supabase.from("services")
          .select("slug,name,short,icon")
          .eq("published", true).neq("slug", slug).limit(3),
      ]);
      if (main.error) throw main.error;
      const svc = main.data ? {
        ...main.data,
        bullets: Array.isArray(main.data.bullets) ? main.data.bullets as string[] : [],
      } as Svc : null;
      return { svc, others: others.data ?? [] };
    },
  });

  if (isLoading) {
    return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!data?.svc) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Service not found</h1>
        <Link to="/services" className="mt-4 inline-block text-primary hover:underline">← Back to all services</Link>
      </div>
    );
  }

  const svc = data.svc;
  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
          <Link to="/services" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All services
          </Link>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-xl gradient-cool text-primary-foreground shadow-soft">
                <DynamicIcon name={svc.icon} className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">{svc.name}</h1>
              <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{svc.description}</p>
            </div>
            <Card className="md:min-w-[260px]">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Starting at</p>
                <p className="text-3xl font-bold">{formatMoney(Number(svc.starting_at))}</p>
                <Link to="/book" search={{ service: svc.slug }}>
                  <Button className="mt-3 w-full gradient-cool text-primary-foreground">Book this service</Button>
                </Link>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> 100% satisfaction guaranteed
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <h2 className="text-2xl font-bold">What's included</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {svc.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.others.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <h2 className="mb-5 text-xl font-bold">Other services you might need</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {data.others.map((s: any) => (
              <Link key={s.slug} to="/services/$slug" params={{ slug: s.slug }}>
                <Card className="h-full transition-all hover:shadow-soft">
                  <CardContent className="p-5">
                    <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary">
                      <DynamicIcon name={s.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.short}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
