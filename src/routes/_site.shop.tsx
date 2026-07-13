import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { products, productCategories, formatMoney, type ProductCategory } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/shop")({
  head: () => ({
    meta: [
      { title: "Shop HVAC Systems — AC, Furnaces, Heat Pumps | HVAC Pro" },
      { name: "description", content: "Shop top-rated central AC units, furnaces, heat pumps, mini-splits, smart thermostats, and air quality equipment — with professional installation." },
      { property: "og:title", content: "Shop HVAC Systems | HVAC Pro" },
      { property: "og:description", content: "AC units, furnaces, heat pumps, and more — installation included." },
    ],
  }),
  component: ShopPage,
});

function iconForCategory(cat: ProductCategory) {
  switch (cat) {
    case "furnace": return "Flame";
    case "thermostat": return "Thermometer";
    case "filter": return "Filter";
    case "heat-pump": return "Zap";
    case "mini-split": return "Wind";
    case "iaq": return "Sparkles";
    default: return "Snowflake";
  }
}

function ShopPage() {
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const { addItem } = useCart();
  const filtered = filter === "all" ? products : products.filter((p) => p.category === filter);

  const handleAdd = (slug: string, name: string) => {
    addItem(slug, { includeInstallation: true });
    toast.success(`${name} added to cart`, { description: "Installation included by default." });
  };

  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Shop</p>
          <h1 className="mt-1 text-3xl font-bold md:text-5xl">HVAC systems & equipment</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every purchase can include professional installation, permits, and a 10-year warranty. Add to cart, book a time, and we handle the rest.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${filter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}
          >
            All ({products.length})
          </button>
          {productCategories.map((c) => {
            const count = products.filter((p) => p.category === c.id).length;
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Card key={p.slug} className="group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elevated">
              <Link to="/shop/$slug" params={{ slug: p.slug }}>
                <div className="relative aspect-[4/3] gradient-cool">
                  <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
                    <DynamicIcon name={iconForCategory(p.category)} className="h-16 w-16 opacity-90" />
                  </div>
                  {p.tag && (
                    <span className="absolute left-3 top-3 rounded-full bg-[color:var(--ember)] px-2 py-0.5 text-xs font-semibold text-[color:var(--ember-foreground)]">
                      {p.tag}
                    </span>
                  )}
                </div>
              </Link>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.brand}</p>
                <Link to="/shop/$slug" params={{ slug: p.slug }}>
                  <h3 className="mt-1 text-base font-semibold leading-tight hover:text-primary">{p.name}</h3>
                </Link>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {p.seer && <span>{p.seer} SEER2</span>}
                  {p.capacityBTU && <span>{(p.capacityBTU / 12000).toFixed(1)} ton</span>}
                  {p.hspf && <span>{p.hspf} HSPF2</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-xl font-bold">{formatMoney(p.price)}</span>
                  <span className="text-xs text-muted-foreground">+ {formatMoney(p.installationFee)} install</span>
                </div>
                <Button
                  onClick={() => handleAdd(p.slug, p.name)}
                  className="mt-4 w-full gradient-cool text-primary-foreground hover:opacity-95"
                >
                  Add to cart
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
