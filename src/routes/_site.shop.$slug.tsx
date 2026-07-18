import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, ShieldCheck, Truck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/shop/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug.replace(/-/g, " ")} — HVAC Pro` }],
  }),
  errorComponent: ({ error }) => <div role="alert" className="p-10 text-center">{error.message}</div>,
  component: ProductDetail,
});

type P = {
  slug: string; name: string; brand: string; category: string;
  price: number; installation_fee: number;
  seer: number | null; capacity_btu: number | null; hspf: number | null;
  description: string; features: string[]; tag: string | null; available: boolean;
  image_url: string | null; resolved_image: string | null;
};

function ProductDetail() {
  const { slug } = Route.useParams();
  const { addItem } = useCart();
  const [withInstall, setWithInstall] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const [main, others] = await Promise.all([
        supabase.from("products")
          .select("slug,name,brand,category,price,installation_fee,seer,capacity_btu,hspf,description,features,tag,available,image_url")
          .eq("slug", slug).eq("published", true).maybeSingle(),
        supabase.from("products").select("slug,name,brand,price,category").eq("published", true).neq("slug", slug).limit(6),
      ]);
      if (main.error) throw main.error;
      let resolved: string | null = null;
      if (main.data?.image_url) {
        const { resolveProductImageUrl } = await import("@/lib/product-image");
        resolved = await resolveProductImageUrl(main.data.image_url);
      }
      const p = main.data ? {
        ...main.data,
        features: Array.isArray(main.data.features) ? main.data.features as string[] : [],
        resolved_image: resolved,
      } as P : null;
      const related = (others.data ?? []).filter((r: any) => r.category === (p?.category ?? "")).slice(0, 3);
      return { p, related };
    },
  });

  if (isLoading) {
    return <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!data?.p) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-primary hover:underline">← Back to shop</Link>
      </div>
    );
  }

  const p = data.p;
  const price = Number(p.price);
  const install = Number(p.installation_fee);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <Link to="/shop" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </Link>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-2xl gradient-cool shadow-elevated">
            {p.resolved_image ? (
              <img src={p.resolved_image} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
                <DynamicIcon
                  name={p.category === "furnace" ? "Flame" : p.category === "thermostat" ? "Thermometer" : p.category === "filter" ? "Filter" : "Snowflake"}
                  className="h-40 w-40 opacity-90"
                />
              </div>
            )}
            {p.tag && (
              <span className="absolute left-4 top-4 rounded-full bg-[color:var(--ember)] px-3 py-1 text-xs font-semibold text-[color:var(--ember-foreground)]">
                {p.tag}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{p.brand}</p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">{p.name}</h1>
            <p className="mt-3 text-muted-foreground">{p.description}</p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {p.seer && <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">{p.seer} SEER2</span>}
              {p.capacity_btu && <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">{(p.capacity_btu / 12000).toFixed(1)} ton</span>}
              {p.hspf && <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">{p.hspf} HSPF2</span>}
            </div>

            <Card className="mt-6">
              <CardContent className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{formatMoney(price + (withInstall ? install : 0))}</span>
                  <span className="text-sm text-muted-foreground">total</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMoney(price)} equipment{withInstall ? ` + ${formatMoney(install)} professional installation` : " (installation not included)"}
                </p>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">Include professional installation</p>
                    <p className="text-xs text-muted-foreground">Permits & 2-year labor warranty included</p>
                  </div>
                  <Switch checked={withInstall} onCheckedChange={setWithInstall} />
                </div>
                <Button
                  size="lg"
                  disabled={!p.available}
                  className="mt-4 w-full gradient-cool text-primary-foreground shadow-soft"
                  onClick={() => {
                    addItem(p.slug, { includeInstallation: withInstall });
                    toast.success("Added to cart");
                  }}
                >
                  {p.available ? "Add to cart" : "Currently unavailable"}
                </Button>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> 10-year warranty</span>
                  <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-primary" /> Free delivery</span>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6">
              <h3 className="font-semibold">Features</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {data.related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <h2 className="mb-5 text-xl font-bold">Similar products</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {data.related.map((r: any) => (
              <Link key={r.slug} to="/shop/$slug" params={{ slug: r.slug }}>
                <Card className="h-full hover:border-primary/35">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{r.brand}</p>
                    <h3 className="mt-1 font-semibold">{r.name}</h3>
                    <p className="mt-2 text-sm font-bold">{formatMoney(Number(r.price))}</p>
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
