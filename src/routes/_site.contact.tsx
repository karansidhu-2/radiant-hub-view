import { createFileRoute } from "@tanstack/react-router";
import Phone from "lucide-react/dist/esm/icons/phone";
import Mail from "lucide-react/dist/esm/icons/mail";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { JsonLd } from "@/components/JsonLd";
import { useSiteSettings, telHref } from "@/hooks/useSiteSettings";

export const Route = createFileRoute("/_site/contact")({
  head: () => ({
    meta: [
      { title: "Contact HVAC Pro — 24/7 AC & Furnace Service, Free Quotes" },
      { name: "description", content: "Contact HVAC Pro for AC repair, furnace repair, and emergency heating & cooling service near you. Licensed, insured technicians. Free installation estimates, 24/7." },
      { property: "og:title", content: "Contact HVAC Pro — 24/7 HVAC Service" },
      { property: "og:description", content: "24/7 emergency AC and furnace repair plus free installation quotes." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/contact" },
    ],
    links: [{ rel: "canonical", href: "https://radiant-hub-view.lovable.app/contact" }],
  }),

  component: ContactPage,
});

function ContactPage() {
  const s = useSiteSettings();
  return (
    <>
      <JsonLd id="contact-localbusiness" data={{
        "@context": "https://schema.org",
        "@type": "HVACBusiness",
        name: s.company_name,
        telephone: s.support_phone,
        email: s.support_email,
        priceRange: "$$",
        address: { "@type": "PostalAddress", streetAddress: s.address },
        areaServed: { "@type": "Country", name: "United States" },
        contactPoint: [{ "@type": "ContactPoint", telephone: s.support_phone, contactType: "customer service", areaServed: "US" }],
      }} />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold md:text-4xl">Contact us</h1>
        <p className="mt-2 text-muted-foreground">24/7 emergency service · Free estimates on installations.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <a href={telHref(s.support_phone)} className="rounded-xl border border-border bg-card p-5 shadow-soft hover:border-primary/35">
            <Phone className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Call</p>
            <p className="font-semibold">{s.support_phone}</p>
          </a>
          <a href={`mailto:${s.support_email}`} className="rounded-xl border border-border bg-card p-5 shadow-soft hover:border-primary/35">
            <Mail className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Email</p>
            <p className="font-semibold">{s.support_email}</p>
          </a>
          <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <MapPin className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Service area</p>
            <p className="font-semibold">{s.address}</p>
          </div>
        </div>
      </section>
    </>
  );
}

