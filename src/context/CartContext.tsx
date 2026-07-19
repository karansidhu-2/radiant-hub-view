import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { products as seedProducts, type Product } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  slug: string;
  quantity: number;
  includeInstallation: boolean;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (slug: string, opts?: { includeInstallation?: boolean; quantity?: number }) => void;
  removeItem: (slug: string) => void;
  updateQuantity: (slug: string, qty: number) => void;
  toggleInstallation: (slug: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  installationTotal: number;
  total: number;
  hydrated: boolean;
  detailed: { item: CartItem; product: Product }[];
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "hvacpro:cart:v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, hydrated]);

  // Fetch live product catalog so admin-created (non-seeded) products
  // still resolve for cart totals, badge count, and checkout.
  const { data: dbProducts = [] } = useQuery({
    queryKey: ["cart", "product-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("slug,name,brand,category,price,installation_fee,description,features,tag,seer,capacity_btu,hspf")
        .eq("published", true);
      if (error) throw error;
      return (data ?? []).map((p): Product => ({
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        category: p.category as Product["category"],
        price: Number(p.price),
        installationFee: Number(p.installation_fee),
        seer: p.seer ?? undefined,
        capacityBTU: p.capacity_btu ?? undefined,
        hspf: p.hspf ?? undefined,
        description: p.description ?? "",
        features: Array.isArray(p.features) ? (p.features as string[]) : [],
        tag: p.tag ?? undefined,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo<CartContextValue>(() => {
    // DB first, seed as fallback so cart still works before the query resolves.
    const bySlug = new Map<string, Product>();
    for (const p of seedProducts) bySlug.set(p.slug, p);
    for (const p of dbProducts) bySlug.set(p.slug, p);

    const detailed = items
      .map((item) => {
        const product = bySlug.get(item.slug);
        return product ? { item, product } : null;
      })
      .filter((v): v is { item: CartItem; product: Product } => v !== null);

    const subtotal = detailed.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);
    const installationTotal = detailed.reduce(
      (sum, { item, product }) => sum + (item.includeInstallation ? product.installationFee * item.quantity : 0),
      0,
    );
    const count = detailed.reduce((sum, { item }) => sum + item.quantity, 0);

    return {
      items,
      hydrated,
      detailed,
      count,
      subtotal,
      installationTotal,
      total: subtotal + installationTotal,
      addItem: (slug, opts) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.slug === slug);
          if (existing) {
            return prev.map((i) =>
              i.slug === slug ? { ...i, quantity: i.quantity + (opts?.quantity ?? 1) } : i,
            );
          }
          return [
            ...prev,
            { slug, quantity: opts?.quantity ?? 1, includeInstallation: opts?.includeInstallation ?? true },
          ];
        }),
      removeItem: (slug) => setItems((prev) => prev.filter((i) => i.slug !== slug)),
      updateQuantity: (slug, qty) =>
        setItems((prev) =>
          qty <= 0 ? prev.filter((i) => i.slug !== slug) : prev.map((i) => (i.slug === slug ? { ...i, quantity: qty } : i)),
        ),
      toggleInstallation: (slug) =>
        setItems((prev) => prev.map((i) => (i.slug === slug ? { ...i, includeInstallation: !i.includeInstallation } : i))),
      clear: () => setItems([]),
    };
  }, [items, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
