import { createFileRoute } from "@tanstack/react-router";
import technicianImg from "@/assets/hvac-technician.asset.json";
import miniSplitImg from "@/assets/hvac-mini-split.asset.json";
import ductworkImg from "@/assets/hvac-ductwork.asset.json";

const SITE = "https://radiant-hub-view.lovable.app";
const ABOUT_OG_IMAGE = `${SITE}${technicianImg.url}`;

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About HVAC Pro — Licensed, NATE-Certified HVAC Company" },
      { name: "description", content: "Family-owned since 2005: NATE-certified technicians serving 50,000+ US homes and businesses with honest pricing, expert installs, and 24/7 emergency HVAC service." },
      { property: "og:title", content: "About HVAC Pro — 20+ Years of Licensed HVAC Service" },
      { property: "og:description", content: "Family-owned, fully insured, NATE-certified. 50,000+ homes served with a 100% satisfaction guarantee on every job." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/about` },
      { property: "og:image", content: ABOUT_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: ABOUT_OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: `${SITE}/about` },
    ],
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
          loading="eager"
          fetchPriority="high"
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
