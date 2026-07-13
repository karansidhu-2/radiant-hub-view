import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/about")({
  head: () => ({ meta: [{ title: "About — HVAC Pro" }, { name: "description", content: "Family-owned HVAC company serving homes and businesses across the US." }] }),
  component: () => (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">About HVAC Pro</h1>
      <p className="mt-4 text-muted-foreground">
        For over 20 years, HVAC Pro has kept US homes and businesses comfortable year-round. Our NATE-certified technicians deliver honest pricing, quality workmanship, and a 100% satisfaction guarantee on every job.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {[["20+", "Years in business"], ["50k+", "Homes served"], ["4.9★", "Average rating"]].map(([n, l]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-5 text-center shadow-soft">
            <p className="text-3xl font-bold text-primary">{n}</p>
            <p className="mt-1 text-sm text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
    </section>
  ),
});
