// Vitest coverage for the RPC audit sanitizer. Ensures sensitive fields
// (email, phone, address, prices, tokens) are stripped before persistence,
// while safe fields (slugs, quantities, counts) survive.

import { describe, it, expect } from "vitest";

// Re-import the private sanitizer via dynamic import + module rewrite.
// We keep sanitize() unexported, so exercise it through logRpcAudit's shape
// by mocking the DB insert and inspecting the payload we build.

// Minimal mock: capture the row that would have been inserted.
let captured: any = null;
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: any) => { captured = row; return { error: null }; },
    }),
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => null,
}));

import { vi } from "vitest";
import { logRpcAudit } from "@/lib/rpc-audit.server";

describe("rpc audit sanitizer", () => {
  it("strips sensitive fields while keeping safe ones", async () => {
    await logRpcAudit({
      event: "createOrder.success",
      entity_type: "order",
      entity_id: "abc-123",
      actor_user_id: "user-1",
      metadata: {
        item_count: 2,
        computed_total: 250.5,
        quantities: [{ slug: "nest-thermostat", qty: 1, install: true }],
        // sensitive — must be dropped:
        email: "leak@example.com",
        phone: "5551234567",
        address: "1 Test St",
        street: "1 Test St",
        city: "New York",
        state: "NY",
        zip: "10001",
        full_name: "Jane Doe",
        unit_price: 0.01,
        price: 0.01,
        installation_fee: 0.01,
        subtotal: 0.01,
        notes: "some private note",
        token: "secret-token",
        password: "hunter2",
      },
    });

    expect(captured).toBeTruthy();
    expect(captured.event).toBe("createOrder.success");
    expect(captured.actor_user_id).toBe("user-1");
    expect(captured.entity_id).toBe("abc-123");

    const meta = captured.metadata as Record<string, unknown>;
    // safe survive
    expect(meta.item_count).toBe(2);
    expect(meta.computed_total).toBe(250.5);
    expect(meta.quantities).toBeTruthy();
    // sensitive stripped
    for (const k of ["email","phone","address","street","city","state","zip","full_name",
                     "unit_price","price","installation_fee","subtotal","notes","token","password"]) {
      expect(meta, `should strip ${k}`).not.toHaveProperty(k);
    }
  });
});
