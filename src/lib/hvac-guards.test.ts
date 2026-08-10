import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { bookingSchema, orderSchema } from "./hvac.functions";

const hasPg = !!process.env.PGHOST;
const psql = (sql: string) =>
  execFileSync("psql", ["-Atqc", sql], { encoding: "utf8" }).trim();
// Multi-statement variant: each -c gets its own implicit transaction, so
// `now()` advances between statements (the rate_limits PK is (key, hit_at)).
const psqlMany = (statements: string[]) =>
  execFileSync("psql", ["-At", ...statements.flatMap((s) => ["-c", s])], {
    encoding: "utf8",
  }).trim();

const baseBooking = {
  full_name: "Test User",
  email: "test@example.com",
  phone: "5551234567",
  street: "123 Main",
  city: "Austin",
  state: "TX",
  zip: "78701",
  service_slug: "ac-tune-up",
  service_name: "AC Tune-Up",
  scheduled_date: "2099-01-01",
  scheduled_hour: 10,
};
const baseOrderItem = {
  product_slug: "p", product_name: "P", brand: null,
  quantity: 1, unit_price: 100, installation_fee: 50, include_installation: false,
};
const baseOrder = {
  ...baseBooking, items: [baseOrderItem],
  scheduled_date: "2099-01-01", scheduled_hour: 10,
};

describe("note length caps (Zod schema)", () => {
  it("accepts a note at exactly 1000 chars on booking", () => {
    const r = bookingSchema.safeParse({ ...baseBooking, notes: "x".repeat(1000) });
    expect(r.success).toBe(true);
  });
  it("rejects a booking note over 1000 chars", () => {
    const r = bookingSchema.safeParse({ ...baseBooking, notes: "x".repeat(1001) });
    expect(r.success).toBe(false);
  });
  it("accepts null / missing notes on booking", () => {
    expect(bookingSchema.safeParse({ ...baseBooking, notes: null }).success).toBe(true);
    expect(bookingSchema.safeParse(baseBooking).success).toBe(true);
  });
  it("accepts a note at exactly 1000 chars on order", () => {
    expect(orderSchema.safeParse({ ...baseOrder, notes: "x".repeat(1000) }).success).toBe(true);
  });
  it("rejects an order note over 1000 chars", () => {
    expect(orderSchema.safeParse({ ...baseOrder, notes: "x".repeat(1001) }).success).toBe(false);
  });
});

describe.skipIf(!hasPg)("rate limits (check_and_hit_rate_limit RPC)", () => {
  const uniq = () =>
    `vitest:rl:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  // The app only ever calls this RPC through the service-role client, so the
  // function is granted to service_role alone. The CI/sandbox login role may
  // therefore be unable to execute it — behavioural assertions below are
  // skipped in that case, while the grant invariant is always asserted.
  const canExecute =
    hasPg &&
    psql(
      `SELECT has_function_privilege(current_user, 'public.check_and_hit_rate_limit(text,integer,integer)', 'EXECUTE')`,
    ) === "t";
  const rl = (key: string, max: number, window: number) =>
    `SELECT public.check_and_hit_rate_limit('${key}', ${max}, ${window})`;

  it("is not executable by anon or authenticated (service_role only)", () => {
    const out = psql(`
      SELECT has_function_privilege('anon', 'public.check_and_hit_rate_limit(text,integer,integer)', 'EXECUTE')
          || ',' ||
             has_function_privilege('authenticated', 'public.check_and_hit_rate_limit(text,integer,integer)', 'EXECUTE')
          || ',' ||
             has_function_privilege('service_role', 'public.check_and_hit_rate_limit(text,integer,integer)', 'EXECUTE')
    `);
    expect(out).toBe("false,false,true");
  });

  it("allows up to _max hits, then blocks the next one in the same window", () => {
    const key = uniq();
    const out = psqlMany([rl(key, 3, 60), rl(key, 3, 60), rl(key, 3, 60), rl(key, 3, 60)])
      .split(/\s+/).filter((x) => x === "t" || x === "f");
    expect(out.slice(0, 3)).toEqual(["t", "t", "t"]);
    expect(out[3]).toBe("f");
  });

  it("scopes limits per key (different buckets do not interfere)", () => {
    const a = uniq(); const b = uniq();
    const out = psqlMany([rl(a, 1, 60), rl(a, 1, 60), rl(b, 1, 60)])
      .split(/\s+/).filter((x) => x === "t" || x === "f");
    expect(out).toEqual(["t", "f", "t"]);
  });
});

describe.skipIf(!hasPg)("bookings.order_id backfill + FK invariants", () => {
  it("has the bookings.order_id -> orders(id) foreign key", () => {
    const out = psql(`
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'public.bookings'::regclass
         AND contype = 'f'
         AND conname = 'bookings_order_id_fkey'
    `);
    expect(out).toBe("bookings_order_id_fkey");
  });

  it("legacy 'Order <ref>' bookings are all linked via order_id (backfill complete)", () => {
    const unlinked = psql(`
      SELECT count(*) FROM public.bookings b
       WHERE b.notes LIKE 'Order %'
         AND b.order_id IS NULL
         AND EXISTS (
           SELECT 1 FROM public.orders o
            WHERE b.notes LIKE 'Order ' || o.reference || '%'
         )
    `);
    expect(Number(unlinked)).toBe(0);
  });

  it("every populated bookings.order_id points at an existing order", () => {
    const orphans = psql(`
      SELECT count(*) FROM public.bookings b
       LEFT JOIN public.orders o ON o.id = b.order_id
       WHERE b.order_id IS NOT NULL AND o.id IS NULL
    `);
    expect(Number(orphans)).toBe(0);
  });
});
