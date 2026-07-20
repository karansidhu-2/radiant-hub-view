// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import {
  createMemoryHistory,
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";

// Capture the onProgress callback passed to useSwipeBack so tests can drive
// the indicator through start/move/end/cancel phases deterministically.
type Phase = "start" | "move" | "end" | "cancel";
let captured: ((p: number, phase: Phase) => void) | null = null;
vi.mock("@/hooks/useSwipeBack", () => ({
  useSwipeBack: ({ onProgress }: { onProgress: (p: number, phase: Phase) => void }) => {
    captured = onProgress;
  },
}));

import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";

function mountAt(initial: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <SwipeBackIndicator fallback="/" />
        <Outlet />
      </>
    ),
  });
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <div>{path}</div> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <div>home</div> }),
      stub("/shop"),
      stub("/services"),
      stub("/book"),
      stub("/account"),
      stub("/admin"),
    ]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}

async function waitForCaptured() {
  for (let i = 0; i < 50 && !captured; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  if (!captured) throw new Error("useSwipeBack was never called");
}

/** The three refs the indicator mutates directly. */
function readRefs(container: HTMLElement) {
  const wrap = container.querySelector('[aria-hidden]') as HTMLElement;
  const fill = wrap.querySelector('.rounded-r-full') as HTMLElement;
  const icon = wrap.querySelector('.rounded-full') as HTMLElement;
  return { wrap, fill, icon };
}

/** Assert the indicator is back in its "initial / hidden" visual state. */
function expectResetState(container: HTMLElement) {
  const { wrap, fill, icon } = readRefs(container);
  expect(wrap.style.opacity).toBe("0");
  expect(wrap.style.transform).toBe("translateX(-12px)");
  // fill collapses back to the 40x6 base and icon fades to opacity 0.
  expect(fill.style.height).toBe("40px");
  expect(fill.style.width).toBe("6px");
  expect(icon.style.opacity).toBe("0");
}

beforeEach(() => {
  captured = null;
  // rAF in jsdom is setTimeout(0); flush via fake timers where needed.
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SwipeBackIndicator", () => {
  it("snap-resets immediately when the gesture is canceled mid-swipe", async () => {
    const { container } = mountAt("/shop");
    expect(captured).toBeTruthy();

    // Drive start + move to activate the indicator.
    act(() => {
      captured!(0, "start");
      captured!(0.6, "move");
    });
    // Allow the scheduled rAF to apply the "active" styles.
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    const { wrap, icon } = readRefs(container);
    expect(wrap.style.opacity).not.toBe("0");
    expect(Number(icon.style.opacity)).toBeGreaterThan(0);

    // Cancel: must snap to initial state in the SAME frame — no waiting.
    act(() => { captured!(0, "cancel"); });
    expectResetState(container);
  });

  it("snap-resets on every route transition (shop → services → book → account)", async () => {
    const { container, router } = mountAt("/shop");

    for (const path of ["/services", "/book", "/account", "/"]) {
      // Simulate a partial swipe leaving the indicator visibly active.
      act(() => {
        captured!(0, "start");
        captured!(0.8, "move");
      });
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const { wrap } = readRefs(container);
      expect(wrap.style.opacity).not.toBe("0");

      // Route change fires the pathname effect, which calls snapReset synchronously.
      await act(async () => { await router.navigate({ to: path }); });
      expectResetState(container);
    }
  });

  it("emits a cancel at navigation start so the indicator does not bleed into the next screen", async () => {
    const { container, router } = mountAt("/services");
    act(() => {
      captured!(0, "start");
      captured!(1, "move");
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    // The hook's real onEnd emits ("end", 1) then a trailing ("cancel", 0)
    // right after router.history.back() / router.navigate() — replicate that
    // sequence and assert the indicator is fully reset by the time the next
    // route is mounted.
    await act(async () => {
      captured!(1, "end");
      await router.navigate({ to: "/shop" });
      captured!(0, "cancel");
    });
    expectResetState(container);
  });

  it("cancel is idempotent — calling it repeatedly keeps the reset state", async () => {
    const { container } = mountAt("/book");
    act(() => {
      captured!(0, "start");
      captured!(0.4, "move");
      captured!(0, "cancel");
      captured!(0, "cancel");
      captured!(0, "cancel");
    });
    expectResetState(container);
  });
});
