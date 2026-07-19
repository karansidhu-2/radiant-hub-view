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

  const value = useMemo<CartContextValue>(() => {
    const detailed = items
      .map((item) => {
        const product = products.find((p) => p.slug === item.slug);
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
