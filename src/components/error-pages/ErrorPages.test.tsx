// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { createMemoryHistory, createRouter, createRootRoute, createRoute, RouterProvider, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

// PermissionErrorState pulls from AuthContext; stub it so the error pages
// can render without a live Supabase session in jsdom.
vi.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ session: null, user: null, loading: false, isAdmin: false, signOut: async () => ({ error: null }) }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import {
  NotFoundPage,
  GenericErrorPage,
  ServerErrorPage,
  UnauthorizedPage,
  OfflinePage,
} from "@/components/error-pages/ErrorPages";
import { OfflineDetector } from "@/components/OfflineDetector";

/**
 * Mount an error page inside a real TanStack router so `<Link>` from the
 * shared error shell resolves. RouterProvider mounts asynchronously, so
 * every assertion below uses `findBy*` to wait for the first paint.
 */
function renderInRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <>{ui}</> });
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <div>{path}</div> });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      stub("/contact"),
      stub("/shop"),
      stub("/services"),
      stub("/auth"),
      stub("/offline"),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => cleanup());

describe("Custom error pages", () => {
  it("404 NotFoundPage renders code, title, and recovery links", async () => {
    renderInRouter(<NotFoundPage />);
    expect(await screen.findByText(/Error 404/i)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /couldn't find that page/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /go home/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /browse shop/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /view services/i })).toBeTruthy();
  });

  it("500 ServerErrorPage renders server-crash content and Retry button", async () => {
    renderInRouter(<ServerErrorPage error={new Error("db down")} />);
    expect(await screen.findByText(/Error 500/i)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /servers are having a moment/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /retry/i })).toBeTruthy();
    expect(await screen.findByText(/db down/i)).toBeTruthy();
  });

  it("401 routes through GenericErrorPage to UnauthorizedPage", async () => {
    const err = Object.assign(new Error("nope"), { status: 401 });
    renderInRouter(<GenericErrorPage error={err} />);
    // UnauthorizedPage uses code=403 label for both 401 and 403.
    expect(await screen.findByText(/Error 403/i)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: /don't have access/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeTruthy();
  });

  it("403 UnauthorizedPage renders directly with sign-in CTA", async () => {
    renderInRouter(<UnauthorizedPage />);
    expect(await screen.findByRole("heading", { name: /don't have access/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeTruthy();
    expect(await screen.findByRole("link", { name: /go home/i })).toBeTruthy();
  });

  it("5xx via GenericErrorPage delegates to ServerErrorPage", async () => {
    const err = Object.assign(new Error("upstream 502"), { status: 502 });
    renderInRouter(<GenericErrorPage error={err} />);
    expect(await screen.findByRole("heading", { name: /servers are having a moment/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("Offline: network error + navigator.onLine=false routes to OfflinePage", async () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      renderInRouter(<GenericErrorPage error={new Error("Failed to fetch")} />);
      expect(await screen.findByRole("heading", { name: /you're offline/i })).toBeTruthy();
      expect(await screen.findByRole("button", { name: /try again/i })).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it("OfflinePage renders directly with troubleshooting tips", async () => {
    renderInRouter(<OfflinePage />);
    expect(await screen.findByRole("heading", { name: /you're offline/i })).toBeTruthy();
    const tips = await screen.findAllByText(/check your wi-fi/i);
    expect(tips.length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /go back/i })).toBeTruthy();
  });

  it("Generic fallback renders when error has no status and browser is online", async () => {
    renderInRouter(<GenericErrorPage error={new Error("boom")} />);
    expect(await screen.findByRole("heading", { name: /something went wrong/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("GenericErrorPage onRetry callback fires when Try again is clicked", async () => {
    const onRetry = vi.fn();
    renderInRouter(<GenericErrorPage error={new Error("boom")} onRetry={onRetry} />);
    (await screen.findByRole("button", { name: /try again/i })).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("OfflineDetector banner", () => {
  it("renders nothing on mount even when navigator.onLine is false (avoids preview false-positives)", () => {
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      const { container } = render(<OfflineDetector />);
      expect(container.textContent ?? "").toBe("");
    } finally {
      spy.mockRestore();
    }
  });

  it("shows offline banner after offline event, then Back-online after online event, then clears", () => {
    vi.useFakeTimers();
    try {
      render(<OfflineDetector />);
      act(() => { window.dispatchEvent(new Event("offline")); });
      expect(screen.getByText(/you're offline/i)).toBeTruthy();

      act(() => { window.dispatchEvent(new Event("online")); });
      expect(screen.getByText(/back online/i)).toBeTruthy();

      act(() => { vi.advanceTimersByTime(2600); });
      expect(screen.queryByText(/back online/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
