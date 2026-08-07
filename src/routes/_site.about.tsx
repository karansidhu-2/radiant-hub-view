import { createFileRoute } from "@tanstack/react-router";
import technicianImg from "@/assets/hvac-technician.asset.json";
import miniSplitImg from "@/assets/hvac-mini-split.asset.json";
import ductworkImg from "@/assets/hvac-ductwork.asset.json";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About HVAC Pro — Licensed HVAC Company Serving the US" },
      { name: "description", content: "Family-owned, NATE-certified HVAC company serving homes and businesses across 28 US states with repair, installation, and 24/7 emergency service." },
      { property: "og:title", content: "About HVAC Pro" },
      { property: "og:description", content: "Licensed, insured, family-owned HVAC contractor." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://radiant-hub-view.lovable.app/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:px-6">
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">About HVAC Pro</h1>
          <p className="mt-4 text-muted-foreground">
            For over 20 years, HVAC Pro has kept US homes and businesses comfortable year-round. Our NATE-certified technicians deliver honest pricing, quality workmanship, and a 100% satisfaction guarantee on every job.
          </p>
        </div>
        <img
          src={technicianImg.url}
          alt="NATE-certified HVAC technician inspecting a condenser unit with a tablet"
          width={612}
          height={408}
          loading="lazy"
          decoding="async"
          sizes="(min-width: 768px) 45vw, 100vw"
          className="aspect-[3/2] w-full rounded-2xl object-cover shadow-elevated ring-1 ring-border"
        />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[["20+", "Years in business"], ["50k+", "Homes served"], ["4.9★", "Average rating"]].map(([n, l]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-5 text-center shadow-soft">
            <p className="text-3xl font-bold text-primary">{n}</p>
            <p className="mt-1 text-sm text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-14 text-2xl font-bold">The work we do</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          { src: miniSplitImg.url, alt: "Wall-mounted ductless mini-split system installed in a living room", caption: "Ductless mini-split installs" },
          { src: ductworkImg.url, alt: "Commercial spiral ductwork running along a building ceiling", caption: "Ductwork design & cleaning" },
        ].map((m) => (
          <figure key={m.caption} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <img
              src={m.src}
              alt={m.alt}
              width={1200}
              height={800}
              loading="lazy"
              decoding="async"
              sizes="(min-width: 640px) 45vw, 100vw"
              className="aspect-[3/2] w-full object-cover"
            />
            <figcaption className="px-4 py-3 text-sm font-semibold">{m.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
