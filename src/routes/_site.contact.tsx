import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/_site/contact")({
  head: () => ({
    meta: [
      { title: "Contact HVAC Pro — 24/7 HVAC Service & Free Quotes" },
      { name: "description", content: "Call or message HVAC Pro for repairs, quotes, or 24/7 emergency AC and furnace service. Licensed technicians across the US." },
      { property: "og:title", content: "Contact HVAC Pro" },
      { property: "og:description", content: "24/7 HVAC support and free installation quotes." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://radiant-hub-view.lovable.app/contact" }],
  }),
  component: () => (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Contact us</h1>
      <p className="mt-2 text-muted-foreground">24/7 emergency service · Free estimates on installations.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <a href="tel:+18005551234" className="rounded-xl border border-border bg-card p-5 shadow-soft hover:border-primary/35">
          <Phone className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Call</p>
          <p className="font-semibold">(800) 555-1234</p>
        </a>
        <a href="mailto:hello@hvacpro.com" className="rounded-xl border border-border bg-card p-5 shadow-soft hover:border-primary/35">
          <Mail className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Email</p>
          <p className="font-semibold">hello@hvacpro.com</p>
        </a>
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <MapPin className="h-5 w-5 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Service area</p>
          <p className="font-semibold">Nationwide, US</p>
        </div>
      </div>
    </section>
  ),
});
