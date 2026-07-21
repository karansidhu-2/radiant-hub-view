// Lightweight in-app observability SDK. Buffers events and flushes to Supabase.
import { supabase } from "@/integrations/supabase/client";

type Kind = "error" | "pageview" | "event" | "vital";

type EventPayload = {
  kind: Kind;
  name: string;
  url?: string | null;
  path?: string | null;
  session_id?: string | null;
  duration_ms?: number | null;
  value?: number | null;
  message?: string | null;
  stack?: string | null;
  meta?: Record<string, unknown>;
  user_agent?: string | null;
};

const SESSION_KEY = "obs_session_id";
const FLUSH_MS = 4000;
const MAX_BUFFER = 25;

let buffer: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.splice(0, buffer.length);
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;
    const rows = batch.map((e) => ({
      kind: e.kind,
      name: e.name.slice(0, 200),
      url: e.url ?? (typeof location !== "undefined" ? location.href : null),
      path: e.path ?? (typeof location !== "undefined" ? location.pathname : null),
      session_id: e.session_id ?? sessionId(),
      user_id: uid,
      duration_ms: e.duration_ms ?? null,
      value: e.value ?? null,
      message: e.message?.slice(0, 1000) ?? null,
      stack: e.stack?.slice(0, 4000) ?? null,
      meta: e.meta ?? {},
      user_agent: e.user_agent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null),
    }));
    await (supabase as any).from("observability_events").insert(rows);
  } catch {
    // swallow — telemetry must never break the app
  }
}

function schedule() {
  if (typeof window === "undefined") return;
  if (buffer.length >= MAX_BUFFER) {
    void flush();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
}

function enqueue(p: EventPayload) {
  buffer.push(p);
  schedule();
}

export function track(name: string, meta: Record<string, unknown> = {}) {
  enqueue({ kind: "event", name, meta });
}

export function trackPageview(path?: string) {
  enqueue({ kind: "pageview", name: "pageview", path: path ?? (typeof location !== "undefined" ? location.pathname : null) });
}

export function captureError(err: unknown, meta: Record<string, unknown> = {}) {
  const e = err as any;
  const message = typeof e === "string" ? e : e?.message ?? String(e ?? "unknown");
  const stack = typeof e === "object" && e?.stack ? String(e.stack) : null;
  enqueue({ kind: "error", name: (e?.name as string) || "Error", message, stack, meta });
}

export function trackVital(name: string, value: number, meta: Record<string, unknown> = {}) {
  enqueue({ kind: "vital", name, value, meta });
}

export function initObservability() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Auto-page view + SPA route changes
  trackPageview();
  let lastPath = location.pathname;
  const emit = () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      trackPageview(lastPath);
    }
  };
  const _push = history.pushState;
  const _replace = history.replaceState;
  history.pushState = function (...args: any[]) { const r = _push.apply(this, args as any); emit(); return r; };
  history.replaceState = function (...args: any[]) { const r = _replace.apply(this, args as any); emit(); return r; };
  window.addEventListener("popstate", emit);

  // Errors
  window.addEventListener("error", (ev) => captureError(ev.error ?? ev.message, { filename: ev.filename, lineno: ev.lineno }));
  window.addEventListener("unhandledrejection", (ev) => captureError(ev.reason, { kind: "unhandledrejection" }));

  // Web Vitals (best-effort, no dep)
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint") trackVital("LCP", entry.startTime);
        else if (entry.entryType === "first-input") trackVital("FID", (entry as any).processingStart - entry.startTime);
        else if (entry.entryType === "layout-shift" && !(entry as any).hadRecentInput) trackVital("CLS", (entry as any).value);
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
    po.observe({ type: "first-input", buffered: true });
    po.observe({ type: "layout-shift", buffered: true });
  } catch {}

  // Flush on unload
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
  window.addEventListener("pagehide", () => void flush());
}
