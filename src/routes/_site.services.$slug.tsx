import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, ArrowLeft, ShieldCheck, Loader2, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";
import { listServiceReviews } from "@/lib/hvac.functions";
import { JsonLd } from "@/components/JsonLd";


export const Route = createFileRoute("/_site/services/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const url = `https://radiant-hub-view.lovable.app/services/${params.slug}`;
    return {
      meta: [
        { title: `${name} — HVAC Pro` },
        { name: "description", content: `Professional ${name.toLowerCase()} from licensed HVAC technicians. Upfront pricing, same-day availability, and guaranteed workmanship.` },
        { property: "og:title", content: `${name} — HVAC Pro` },
        { property: "og:description", content: `Book ${name.toLowerCase()} with HVAC Pro — licensed, insured, guaranteed.` },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: ({ error }) => <div role="alert" className="p-10 text-center">{error.message}</div>,
  component: ServiceDetail,
});

type Svc = {
  slug: string; name: string; short: string; description: string;
  starting_at: number; icon: string; bullets: string[];
};

function ServiceDetail() {
  const { slug } = Route.useParams();

  const reviewsFn = useServerFn(listServiceReviews);
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

  const { data: rv } = useQuery({
    queryKey: ["service-reviews", slug],
    queryFn: () => reviewsFn({ data: { service_slug: slug } }),
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
      <JsonLd id={`service-${svc.slug}`} data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: svc.name,
        description: svc.short || svc.description,
        serviceType: svc.name,
        provider: { "@type": "LocalBusiness", "@id": "https://radiant-hub-view.lovable.app/#business", name: "HVAC Pro" },
        areaServed: { "@type": "Country", name: "United States" },
        offers: { "@type": "Offer", price: svc.starting_at, priceCurrency: "USD", availability: "https://schema.org/InStock" },
        ...(rv && rv.count > 0 ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(rv.avg ?? 0).toFixed(1),
            reviewCount: rv.count,
          },
        } : {}),

      }} />
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
              {rv && rv.count > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <StarRating value={rv.avg} readOnly size={16} />
                  <span className="font-semibold">{rv.avg.toFixed(1)}</span>
                  <span className="text-muted-foreground">({rv.count} review{rv.count === 1 ? "" : "s"})</span>
                </div>
              )}
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

      <section className="mx-auto max-w-7xl px-4 pb-14 md:px-6">
        <div className="mb-5 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Customer reviews</h2>
        </div>
        {!rv || rv.count === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            No reviews yet. Be the first — book this service and share your experience.
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rv.list.map((r: any) => (
              <Card key={r.id} className="card-pop">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{r.author}</p>
                    <StarRating value={r.rating} readOnly size={16} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                  {r.admin_reply && (
                    <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase text-primary">Response from the team</p>
                      <p className="mt-1">{r.admin_reply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {data.others.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <h2 className="mb-5 text-xl font-bold">Other services you might need</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {data.others.map((s: any) => (
              <Link key={s.slug} to="/services/$slug" params={{ slug: s.slug }}>
                <Card className="card-pop h-full hover:border-primary/35">
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
