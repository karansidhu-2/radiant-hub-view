import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_site/book")({
  validateSearch: (s: Record<string, unknown>) => ({
    service: typeof s.service === "string" ? s.service : undefined,
    fromCart: s.fromCart === true || s.fromCart === "true",
  }),
  head: () => ({ meta: [{ title: "Book Service — HVAC Pro" }, { name: "description", content: "Schedule your HVAC service or installation appointment." }] }),
  component: BookPage,
});

function BookPage() {
  const { service, fromCart } = Route.useSearch();
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Book your appointment</h1>
      <p className="mt-2 text-muted-foreground">
        {fromCart ? "Confirm installation details for your cart." : service ? `Booking: ${service}` : "Tell us what you need — we'll confirm within 1 business hour."}
      </p>
      <form
        className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          alert("Thanks! We'll call you shortly to confirm your appointment.");
        }}
      >
        <input required placeholder="Full name" className="rounded-md border border-input bg-background px-3 py-2" />
        <input required type="email" placeholder="Email" className="rounded-md border border-input bg-background px-3 py-2" />
        <input required type="tel" placeholder="Phone" className="rounded-md border border-input bg-background px-3 py-2" />
        <input required placeholder="Street address" className="rounded-md border border-input bg-background px-3 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="City" className="rounded-md border border-input bg-background px-3 py-2" />
          <input required placeholder="ZIP" className="rounded-md border border-input bg-background px-3 py-2" />
        </div>
        <input required type="date" className="rounded-md border border-input bg-background px-3 py-2" />
        <textarea placeholder="Describe the issue (optional)" rows={4} className="rounded-md border border-input bg-background px-3 py-2" />
        <button type="submit" className="rounded-md gradient-cool px-4 py-3 font-semibold text-primary-foreground shadow-soft">
          Request appointment
        </button>
        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
      </form>
    </section>
  );
}
