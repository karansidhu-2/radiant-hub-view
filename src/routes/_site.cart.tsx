import { Link, createFileRoute } from "@tanstack/react-router";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { formatMoney } from "@/data/products";


export const Route = createFileRoute("/_site/cart")({
  head: () => ({ meta: [{ title: "Your Cart — HVAC Pro" }, { name: "description", content: "Review your HVAC equipment and installation before booking." }, { name: "robots", content: "noindex, follow" }] }),
  component: CartPage,
});

function CartPage() {
  const { detailed, subtotal, installationTotal, total, updateQuantity, removeItem, toggleInstallation, hydrated } = useCart();

  if (hydrated && detailed.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Browse our systems and add professional installation in one click.</p>
        <Link to="/shop"><Button className="mt-6 gradient-cool text-primary-foreground">Shop systems</Button></Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {detailed.map(({ item, product }) => (
            <Card key={product.slug}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row">
                <div className="grid h-24 w-full shrink-0 place-items-center rounded-lg gradient-cool text-primary-foreground sm:w-24">
                  <span className="text-2xl font-bold">{product.brand[0]}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{product.brand}</p>
                  <Link to="/shop/$slug" params={{ slug: product.slug }} className="text-base font-semibold hover:text-primary">{product.name}</Link>
                  <p className="mt-1 text-sm font-bold">{formatMoney(product.price)} <span className="text-xs font-normal text-muted-foreground">/ each</span></p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border p-2 text-xs">
                    <div>
                      <p className="font-semibold">Include installation ({formatMoney(product.installationFee)}/unit)</p>
                      <p className="text-muted-foreground">Permits & 2-year labor warranty</p>
                    </div>
                    <Switch checked={item.includeInstallation} onCheckedChange={() => toggleInstallation(product.slug)} />
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between gap-3">
                  <div className="flex items-center gap-1 rounded-full border border-border">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(product.slug, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(product.slug, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(product.slug)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
        </div>

        <Card className="h-fit sticky top-24">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold">Order summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Equipment subtotal</span><span className="font-semibold">{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Installation</span><span className="font-semibold">{formatMoney(installationTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estimated tax</span><span className="text-xs text-muted-foreground">Calculated at booking</span></div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-baseline justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-bold">{formatMoney(total)}</span></div>
            <Link to="/checkout">
              <Button size="lg" className="mt-5 w-full gradient-cool text-primary-foreground shadow-soft">Proceed to checkout</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
