// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { createMemoryHistory, createRouter, createRootRoute, createRoute, RouterProvider, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  NotFoundPage,
  GenericErrorPage,
  ServerErrorPage,
  UnauthorizedPage,
  OfflinePage,
} from "@/components/error-pages/ErrorPages";
import { OfflineDetector } from "@/components/OfflineDetector";

// ---------- Test harness: mount error pages inside a real TanStack router
// so `<Link>` from the shared error shell resolves without throwing. --------
function renderInRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <>{ui}</> });
  const contactRoute = createRoute({ getParentRoute: () => rootRoute, path: "/contact", component: () => <div>contact</div> });
  const shopRoute = createRoute({ getParentRoute: () => rootRoute, path: "/shop", component: () => <div>shop</div> });
  const servicesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/services", component: () => <div>services</div> });
  const authRoute = createRoute({ getParentRoute: () => rootRoute, path: "/auth", component: () => <div>auth</div> });
  const offlineRoute = createRoute({ getParentRoute: () => rootRoute, path: "/offline", component: () => <div>offline</div> });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, contactRoute, shopRoute, servicesRoute, authRoute, offlineRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => cleanup());

describe("Custom error pages", () => {
  it("404 NotFoundPage renders code, title, and recovery links", () => {
    renderInRouter(<NotFoundPage />);
    expect(screen.getByText(/Error 404/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /couldn't find that page/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /go home/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /browse shop/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view services/i })).toBeTruthy();
  });

  it("500 ServerErrorPage renders server-crash content and Retry button", () => {
    renderInRouter(<ServerErrorPage error={new Error("db down")} />);
    expect(screen.getByText(/Error 500/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /servers are having a moment/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.getByText(/db down/i)).toBeTruthy();
  });

  it("401 routes through GenericErrorPage to UnauthorizedPage", () => {
    const err = Object.assign(new Error("nope"), { status: 401 });
    renderInRouter(<GenericErrorPage error={err} />);
    expect(screen.getByText(/Error 403/i)).toBeTruthy(); // Unauthorized shell uses 403 label
    expect(screen.getByRole("heading", { name: /don't have access/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
  });

  it("403 UnauthorizedPage renders directly with sign-in CTA", () => {
    renderInRouter(<UnauthorizedPage />);
    expect(screen.getByRole("heading", { name: /don't have access/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /go home/i })).toBeTruthy();
  });

  it("500 via GenericErrorPage delegates to ServerErrorPage", () => {
    const err = Object.assign(new Error("upstream 502"), { status: 502 });
    renderInRouter(<GenericErrorPage error={err} />);
    expect(screen.getByRole("heading", { name: /servers are having a moment/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("Offline: network error + navigator.onLine=false routes to OfflinePage", () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderInRouter(<GenericErrorPage error={new Error("Failed to fetch")} />);
    expect(screen.getByRole("heading", { name: /you're offline/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
    spy.mockRestore();
  });

  it("OfflinePage renders directly with troubleshooting tips", () => {
    renderInRouter(<OfflinePage />);
    expect(screen.getByRole("heading", { name: /you're offline/i })).toBeTruthy();
    expect(screen.getByText(/check your wi-fi/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /go back/i })).toBeTruthy();
  });

  it("Generic fallback renders when error has no status and browser is online", () => {
    renderInRouter(<GenericErrorPage error={new Error("boom")} />);
    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("GenericErrorPage onRetry callback fires when Try again is clicked", async () => {
    const onRetry = vi.fn();
    renderInRouter(<GenericErrorPage error={new Error("boom")} onRetry={onRetry} />);
    screen.getByRole("button", { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("OfflineDetector banner", () => {
  beforeEach(() => cleanup());

  it("renders nothing on mount even when navigator.onLine is false (avoids preview false-positives)", () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { container } = render(<OfflineDetector />);
    expect(container.textContent ?? "").toBe("");
    spy.mockRestore();
  });

  it("shows the offline banner after an offline event, then a Back-online message after online event", () => {
    vi.useFakeTimers();
    try {
      render(<OfflineDetector />);
      act(() => { window.dispatchEvent(new Event("offline")); });
      expect(screen.getByText(/you're offline/i)).toBeTruthy();

      act(() => { window.dispatchEvent(new Event("online")); });
      expect(screen.getByText(/back online/i)).toBeTruthy();

      // Banner disappears after the restore timeout.
      act(() => { vi.advanceTimersByTime(2600); });
      expect(screen.queryByText(/back online/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
