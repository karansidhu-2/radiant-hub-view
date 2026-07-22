import { CreditCard, ShieldCheck, Zap, CalendarClock, Info } from "lucide-react";
import { formatMoney } from "@/data/products";

/**
 * Financing terms shown to customers. These are illustrative
 * promotional-financing tiers commonly offered by HVAC lenders
 * (Synchrony / Wells Fargo / GreenSky style plans). Actual approval
 * and APR are determined by the lender at checkout.
 */
const PLANS = [
  { months: 12, apr: 0, label: "0% APR" },
  { months: 24, apr: 0, label: "0% APR" },
  { months: 60, apr: 9.99, label: "9.99% APR" },
  { months: 120, apr: 12.99, label: "12.99% APR" },
];

function monthly(total: number, months: number, apr: number) {
  if (total <= 0) return 0;
  if (apr === 0) return total / months;
  const r = apr / 100 / 12;
  return (total * r) / (1 - Math.pow(1 + r, -months));
}

interface Props {
  total: number;
  compact?: boolean;
}

/**
 * Visible financing / monthly-payment estimator with a benefits summary.
 * Purely presentational — the actual credit application happens with the
 * lender after checkout (we surface a placeholder CTA for now).
 */
export function FinancingOption({ total, compact = false }: Props) {
  if (total <= 0) return null;

  // Headline number: the most attractive 0% APR long-term plan the user qualifies for by amount.
  const headline = PLANS[1]; // 24 mo @ 0%
  const headlineMonthly = monthly(total, headline.months, headline.apr);

  if (compact) {
    return (
      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="font-semibold">
            Or from {formatMoney(Math.ceil(headlineMonthly))}/mo
          </span>
          <span className="text-xs text-muted-foreground">· {headline.months} mo · 0% APR*</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Subject to credit approval. Prequalify at checkout — no impact to your score.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Financing and monthly payment options"
      className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-soft"
    >
      <header className="flex items-center gap-3 border-b border-border bg-accent/40 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold">Pay monthly — from {formatMoney(Math.ceil(headlineMonthly))}/mo</h3>
          <p className="text-xs text-muted-foreground">
            Flexible financing on this order · Prequalify in 60 seconds
          </p>
        </div>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        {/* Plans */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose your term
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const m = monthly(total, plan.months, plan.apr);
              return (
                <div
                  key={plan.months}
                  className="rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold">{formatMoney(Math.ceil(m))}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                    <span className="text-[11px] font-semibold text-primary">{plan.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plan.months} months · {formatMoney(total)} total{plan.apr === 0 ? "" : ` financed`}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Estimates only. Actual rate and term depend on lender approval, credit profile, and promo eligibility. 0% APR plans require on-time monthly payments.
          </p>
        </div>

        {/* Benefits */}
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why finance with us
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex gap-2">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><b>No money down.</b> Get installed today, pay over time — no big upfront hit to your budget.</span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><b>Soft credit check.</b> See if you prequalify without any impact to your credit score.</span>
            </li>
            <li className="flex gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><b>0% promo plans.</b> Pay interest-free for up to 24 months when you keep to the schedule.</span>
            </li>
            <li className="flex gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><b>Bundle everything.</b> Equipment, professional installation, and permits all in one predictable monthly payment.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
