import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Clock, DollarSign, MapPin, PhoneCall, ShieldCheck, Sparkles, Star, Wrench } from "lucide-react";
import heroImg from "@/assets/hvac-hero.webp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { services } from "@/data/services";
import { products, formatMoney } from "@/data/products";
import { DynamicIcon } from "@/components/DynamicIcon";
import { MobileQuickAccess } from "@/components/MobileQuickAccess";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "HVAC Pro — AC, Heating & Installation Services in the US" },
      { name: "description", content: "Same-day HVAC repair, new system installation, and 24/7 emergency service. Shop AC units, furnaces, heat pumps, and thermostats — installation included." },
      { property: "og:title", content: "HVAC Pro — AC, Heating & Installation" },
      { property: "og:description", content: "Trusted, licensed HVAC service and installation across 28 US states." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://radiant-hub-view.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://radiant-hub-view.lovable.app/" },
      { rel: "preload", as: "image", href: heroImg, fetchpriority: "high" },
    ],
  }),
  component: Home,
});


const trustPoints = [
  { icon: ShieldCheck, label: "Licensed & Insured" },
  { icon: BadgeCheck, label: "NATE-Certified Techs" },
  { icon: Clock, label: "24/7 Emergency" },
  { icon: DollarSign, label: "Upfront Pricing" },
];

const howItWorks = [
  { icon: Sparkles, title: "1. Choose service or system", body: "Browse services or shop AC units, furnaces, and heat pumps. Add installation to any product." },
  { icon: Clock, title: "2. Book a time that fits", body: "Pick a morning, afternoon, or evening window — even same day. We confirm within an hour." },
  { icon: Wrench, title: "3. We install & service", body: "Certified techs arrive on time, protect your home, and leave the job spotless. Fully guaranteed." },
];

const testimonials = [
  { name: "Sarah M.", city: "Austin, TX", quote: "Our AC died at 9 PM in July. HVAC Pro had a tech at our door by 11 PM with the exact part. Absolute lifesavers." },
  { name: "David R.", city: "Denver, CO", quote: "Installed a new heat pump for us — walked us through IRA tax credits and utility rebates. Saved us $3,200." },
  { name: "Jenna T.", city: "Charlotte, NC", quote: "Signed up for the maintenance plan two years ago. Zero surprise breakdowns since." },
];

function Home() {
  const featured = products.slice(0, 4);
  const homeServices = services.slice(0, 6);
  return (
    <>
      <MobileQuickAccess />
      {/* Hero */}

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-hero opacity-95" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-2 md:gap-8 md:px-6 md:py-24 lg:py-28">
          <div className="flex flex-col justify-center text-primary-foreground">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--ember)]" /> Same-day service across 28 states
            </span>
            <h1 className="text-[2rem] font-bold leading-[1.1] md:text-5xl lg:text-6xl">
              Comfort you can count on.
              <span className="mt-2 block bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                All year, every year.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] text-white/85 md:mt-5 md:text-lg">
              Licensed heating, cooling, and air quality experts. Book same-day repair, order a new system with professional installation, or get a free replacement quote in minutes.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap md:mt-8 md:gap-3">
              <Link to="/book" search={{ service: undefined }} className="w-full sm:w-auto">
                <Button size="lg" className="h-12 w-full bg-[color:var(--ember)] text-[color:var(--ember-foreground)] shadow-elevated hover:opacity-90 sm:w-auto">
                  Book Service <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/shop" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-12 w-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto">
                  Shop Systems
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {trustPoints.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-white/85">
                  <Icon className="h-4 w-4 text-[color:var(--ember)]" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-1 -z-10 rounded-3xl bg-white/10" />
            <img
              src={heroImg}
              alt="HVAC Pro technician servicing an outdoor air conditioning condenser"
              width={1200}
              height={825}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full rounded-2xl object-cover shadow-elevated ring-1 ring-white/20"
            />

            <div className="absolute -bottom-5 left-4 hidden items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-elevated md:flex">
              <div className="flex -space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[color:var(--ember)] text-[color:var(--ember)]" />
                ))}
              </div>
              <div className="text-xs">
                <div className="font-semibold">4.9 / 5 · 12,000+ jobs</div>
                <div className="text-muted-foreground">Verified customer reviews</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Services */}


      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Our services</p>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">Full-service heating, cooling & air quality</h2>
          </div>
          <Link to="/services" className="text-sm font-semibold text-primary hover:underline">See all services →</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {homeServices.map((s) => (
            <Link key={s.slug} to="/services/$slug" params={{ slug: s.slug }} className="group">
              <Card className="card-pop h-full hover:border-primary/35">
                <CardContent className="p-6">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg gradient-cool text-primary-foreground">
                    <DynamicIcon name={s.icon} className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{s.name}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.short}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Starting at <span className="font-semibold text-foreground">{formatMoney(s.startingAt)}</span></span>
                    <span className="font-semibold text-primary group-hover:underline">Learn more →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-secondary/40 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Shop systems</p>
              <h2 className="mt-1 text-3xl font-bold md:text-4xl">Top-rated equipment with installation</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">Every system includes professional installation, permits, and a 10-year manufacturer warranty.</p>
            </div>
            <Link to="/shop" className="text-sm font-semibold text-primary hover:underline">Browse all products →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <Link key={p.slug} to="/shop/$slug" params={{ slug: p.slug }}>
                <Card className="card-pop group h-full overflow-hidden hover:border-primary/35">
                  <div className="relative aspect-[4/3] gradient-cool">
                    <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
                      <DynamicIcon
                        name={p.category === "furnace" ? "Flame" : p.category === "thermostat" ? "Thermometer" : p.category === "filter" ? "Filter" : "Snowflake"}
                        className="h-16 w-16 opacity-90"
                      />
                    </div>
                    {p.tag && (
                      <span className="absolute left-3 top-3 rounded-full bg-[color:var(--ember)] px-2 py-0.5 text-xs font-semibold text-[color:var(--ember-foreground)]">
                        {p.tag}
                      </span>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.brand}</p>
                    <h3 className="mt-1 text-base font-semibold leading-tight">{p.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-lg font-bold">{formatMoney(p.price)}</span>
                      <span className="text-xs text-muted-foreground">+ install</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</p>
          <h2 className="mt-1 text-3xl font-bold md:text-4xl">Comfort in three simple steps</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((s) => (
            <Card key={s.title} className="border-border/70">
              <CardContent className="p-7">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-full gradient-warm text-[color:var(--ember-foreground)]">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-secondary/40 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">What customers say</p>
            <h2 className="mt-1 text-3xl font-bold md:text-4xl">Trusted by 12,000+ homeowners</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name}>
                <CardContent className="p-6">
                  <div className="mb-3 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-[color:var(--ember)] text-[color:var(--ember)]" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed">"{t.quote}"</p>
                  <p className="mt-4 text-sm font-semibold">{t.name} <span className="font-normal text-muted-foreground">· {t.city}</span></p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Service area */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <Card className="overflow-hidden border-0 gradient-hero text-primary-foreground shadow-elevated">
          <CardContent className="grid gap-8 p-10 md:grid-cols-[1.2fr_1fr] md:p-14">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> 28 states · 140+ metro areas
              </p>
              <h2 className="text-3xl font-bold md:text-4xl">Ready when you need us — day or night</h2>
              <p className="mt-3 max-w-lg text-white/85">
                Every job is backed by our 100% satisfaction guarantee. Financing available with 0% APR for qualified buyers. No hidden fees. Ever.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/book" search={{ service: undefined }}><Button size="lg" className="bg-white text-primary hover:bg-white/90">Book Now</Button></Link>
                <a href="tel:18005551234">
                  <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                    <PhoneCall className="mr-1 h-4 w-4" /> (800) 555-1234
                  </Button>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {["Texas", "Colorado", "Arizona", "Georgia", "N. Carolina", "Florida", "Virginia", "Tennessee", "Ohio", "Illinois"].map((state) => (
                <div key={state} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 text-[color:var(--ember)]" /> {state}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
