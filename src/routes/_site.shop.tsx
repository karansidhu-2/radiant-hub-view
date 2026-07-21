import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productCategories, formatMoney, type ProductCategory } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useAutoRatings } from "@/hooks/useAutoRatings";
import { AutoRatingBadge } from "@/components/AutoRatingBadge";
import { ProductGridSkeleton } from "@/components/skeletons";
import { SmartImage } from "@/components/SmartImage";

export const Route = createFileRoute("/_site/shop")({
  head: () => ({
    meta: [
      { title: "Shop HVAC Systems — AC, Furnaces, Heat Pumps | HVAC Pro" },
      { name: "description", content: "Shop top-rated central AC units, furnaces, heat pumps, mini-splits, smart thermostats, and air quality equipment — with professional installation." },
      { property: "og:title", content: "Shop HVAC Systems | HVAC Pro" },
      { property: "og:description", content: "AC units, furnaces, heat pumps, and more — installation included." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/shop" },
    ],
    links: [{ rel: "canonical", href: "https://radiant-hub-view.lovable.app/shop" }],
  }),
  component: ShopPage,
});

function iconForCategory(cat: string) {
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

type ProductRow = {
  slug: string; name: string; brand: string; category: string;
  price: number; installation_fee: number;
  seer: number | null; capacity_btu: number | null; hspf: number | null;
  tag: string | null; available: boolean; image_url: string | null;
};

type SortKey = "featured" | "price-asc" | "price-desc" | "name" | "top-rated";

function ShopPage() {
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { addItem } = useCart();
  const { data: autoRatings } = useAutoRatings();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("slug,name,brand,category,price,installation_fee,seer,capacity_btu,hspf,tag,available,image_url")
        .eq("published", true)
        .order("name");
      if (error) throw error;
      const rows = (data ?? []) as ProductRow[];
      const paths = rows.map((r) => r.image_url).filter(Boolean) as string[];
      const urls = paths.length ? await (await import("@/lib/product-image")).resolveProductImageUrls(paths) : {};
      return rows.map((r) => ({ ...r, resolved_image: r.image_url ? urls[r.image_url] ?? null : null }));
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products]
  );
  const maxPrice = useMemo(
    () => products.reduce((m, p) => Math.max(m, Number(p.price) || 0), 0),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (brand !== "all" && p.brand !== brand) return false;
      if (inStockOnly && !p.available) return false;
      if (priceMax != null && Number(p.price) > priceMax) return false;
      if (q) {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.tag ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (sort) {
      case "price-asc": list = [...list].sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price-desc": list = [...list].sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "name": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case "top-rated":
        list = [...list].sort((a, b) => {
          const ra = autoRatings?.[a.slug];
          const rb = autoRatings?.[b.slug];
          const sa = ra ? Number(ra.auto_rating) + Number(ra.auto_confidence) * 0.5 : 0;
          const sb = rb ? Number(rb.auto_rating) + Number(rb.auto_confidence) * 0.5 : 0;
          return sb - sa;
        });
        break;
      default: /* featured = default from db */ break;
    }
    return list;
  }, [products, filter, brand, inStockOnly, priceMax, query, sort, autoRatings]);

  const handleAdd = (slug: string, name: string) => {
    addItem(slug, { includeInstallation: true });
    toast.success(`${name} added to cart`, { description: "Installation included by default." });
  };

  const activeFilterCount =
    (filter !== "all" ? 1 : 0) +
    (brand !== "all" ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceMax != null ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const clearAll = () => {
    setFilter("all"); setBrand("all"); setInStockOnly(false);
    setPriceMax(null); setQuery(""); setSort("featured");
  };

  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary md:text-sm">Shop</p>
          <h1 className="mt-1 text-2xl font-bold md:text-5xl">HVAC systems & equipment</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:mt-3 md:text-base">
            Every purchase can include professional installation, permits, and a 10-year warranty. Add to cart, book a time, and we handle the rest.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {/* Search + sort bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, brand, or tag…"
              className="pl-9 pr-9"
              aria-label="Search products"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort products"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="featured">Featured</option>
            <option value="top-rated">Top auto-rated</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A → Z</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)} className="sm:hidden">
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Filters
            {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
          </Button>
        </div>

        {/* Filters panel */}
        <div className={`mb-6 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 ${showFilters ? "grid" : "hidden sm:grid"}`}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand</label>
            <select
              value={brand} onChange={(e) => setBrand(e.target.value)}
              aria-label="Filter by brand"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">All brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Max price {priceMax != null ? `— ${formatMoney(priceMax)}` : "— any"}
            </label>
            <input
              type="range"
              min={0}
              max={Math.max(1000, Math.ceil(maxPrice / 500) * 500)}
              step={100}
              value={priceMax ?? Math.max(1000, Math.ceil(maxPrice / 500) * 500)}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              aria-label="Maximum price"
              className="w-full"
            />
            {priceMax != null && (
              <button className="text-[11px] text-primary underline" onClick={() => setPriceMax(null)}>Reset</button>
            )}
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              In stock only
            </label>
          </div>
        </div>

        {/* Category chips */}
        <div className="mb-6 flex flex-wrap gap-2">
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

        {/* Results summary */}
        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>{filtered.length} product{filtered.length === 1 ? "" : "s"}</p>
          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="text-primary hover:underline">Clear all filters</button>
          )}
        </div>

        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="font-semibold">No products match your filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or clearing filters.</p>
            <Button onClick={clearAll} variant="outline" size="sm" className="mt-4">Clear all filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <Card key={p.slug} className="card-pop group overflow-hidden hover:border-primary/35">
                <Link to="/shop/$slug" params={{ slug: p.slug }}>
                  <div className="relative aspect-[4/3] gradient-cool overflow-hidden">
                    {(p as any).resolved_image ? (
                      <SmartImage
                        src={(p as any).resolved_image}
                        alt={p.name}
                        widths={[240, 320, 480, 640]}
                        sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 48vw"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
                        <DynamicIcon name={iconForCategory(p.category)} className="h-16 w-16 opacity-90" />
                      </div>
                    )}
                    {p.tag && (
                      <span className="absolute left-3 top-3 rounded-full bg-[color:var(--ember)] px-2 py-0.5 text-xs font-semibold text-[color:var(--ember-foreground)]">
                        {p.tag}
                      </span>
                    )}
                    {!p.available && (
                      <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                        Out of stock
                      </span>
                    )}
                  </div>
                </Link>
                <CardContent className="p-3 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">{p.brand}</p>
                    <AutoRatingBadge rating={autoRatings?.[p.slug]} compact />
                  </div>
                  <Link to="/shop/$slug" params={{ slug: p.slug }}>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight hover:text-primary sm:text-base">{p.name}</h3>
                  </Link>
                  <div className="mt-2 hidden flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex">
                    {p.seer && <span>{p.seer} SEER2</span>}
                    {p.capacity_btu && <span>{(p.capacity_btu / 12000).toFixed(1)} ton</span>}
                    {p.hspf && <span>{p.hspf} HSPF2</span>}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1 sm:mt-3">
                    <span className="text-base font-bold sm:text-xl">{formatMoney(Number(p.price))}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">+ {formatMoney(Number(p.installation_fee))} install</span>
                  </div>
                  <Button
                    onClick={() => handleAdd(p.slug, p.name)}
                    disabled={!p.available}
                    className="mt-3 h-10 w-full gradient-cool text-primary-foreground hover:opacity-95 sm:mt-4"
                  >
                    {p.available ? "Add to cart" : "Unavailable"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
