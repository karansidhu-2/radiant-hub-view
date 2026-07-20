import * as React from "react";

/**
 * Lightweight in-app performance profiler.
 *
 * Wrap slow subtrees in <PerfProfiler id="…">…</PerfProfiler>. It uses
 * React's built-in <Profiler> to measure commit durations, and logs a
 * grouped console warning whenever a render (or a state update that
 * caused a render) exceeds the threshold.
 *
 * `useRenderProfiler("id", deps)` complements it for hook-heavy leaves —
 * it measures the interval between renders and flags whichever dep
 * changed and how long the render took to reach the effect phase.
 *
 * Zero cost in production: the whole file no-ops when
 * `import.meta.env.PROD` is true.
 */

const IS_DEV =
  typeof import.meta !== "undefined" &&
  !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;

// Detailed logging is ALWAYS off in production regardless of any stored flag.
// In development, admins can adjust thresholds + toggle logging via
// <PerfProfilerControls />; settings persist in localStorage.
const LS_KEY = "perf-profiler:settings:v1";
type Settings = {
  enabled: boolean;
  slowMs: number;
  verySlowMs: number;
  detailedLogging: boolean;
};
const DEFAULTS: Settings = {
  enabled: true,
  slowMs: 32,
  verySlowMs: 80,
  detailedLogging: true,
};

function readSettings(): Settings {
  if (!IS_DEV) return { ...DEFAULTS, enabled: false, detailedLogging: false };
  try {
    if (typeof localStorage === "undefined") return DEFAULTS;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

let settings: Settings = readSettings();
const subs = new Set<() => void>();
function notify() { for (const fn of subs) fn(); }

export function updatePerfSettings(patch: Partial<Settings>) {
  if (!IS_DEV) return;
  settings = { ...settings, ...patch };
  try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
  notify();
}
export function getPerfSettings(): Settings { return settings; }

type Sample = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actual: number;
  base: number;
  ts: number;
};

const recent: Sample[] = [];

export function getRecentPerfSamples(): ReadonlyArray<Sample> {
  return recent;
}

function onRender(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
) {
  if (!IS_DEV || !settings.enabled) return;
  const sample: Sample = {
    id,
    phase,
    actual: actualDuration,
    base: baseDuration,
    ts: Date.now(),
  };
  recent.push(sample);
  if (recent.length > 100) recent.shift();

  if (!settings.detailedLogging) return;
  if (actualDuration >= settings.slowMs) {
    const level = actualDuration >= settings.verySlowMs ? "error" : "warn";
    // eslint-disable-next-line no-console
    console[level](
      `[perf] slow render — ${id} (${phase}) actual=${actualDuration.toFixed(
        1,
      )}ms base=${baseDuration.toFixed(1)}ms`,
    );
  }
}


export function PerfProfiler({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  if (!IS_DEV || !settings.enabled) return <>{children}</>;
  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );
}

/**
 * Log which dependency triggered a re-render and how long the surrounding
 * state update took. Pass a stable label and the deps you want tracked.
 */
export function useRenderProfiler(label: string, deps: Record<string, unknown>) {
  const prev = React.useRef<Record<string, unknown> | null>(null);
  const lastRenderTs = React.useRef<number>(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );

  if (IS_DEV && settings.enabled && settings.detailedLogging) {

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const gap = now - lastRenderTs.current;
    lastRenderTs.current = now;

    if (prev.current) {
      const changed: string[] = [];
      for (const key of Object.keys(deps)) {
        if (!Object.is(prev.current[key], deps[key])) changed.push(key);
      }
      if (changed.length && gap < 16) {
        // eslint-disable-next-line no-console
        console.warn(
          `[perf] rapid re-render — ${label} in ${gap.toFixed(
            1,
          )}ms, changed: ${changed.join(", ")}`,
        );
      } else if (changed.length > 3) {
        // eslint-disable-next-line no-console
        console.warn(
          `[perf] wide state change — ${label} touched ${changed.length} deps: ${changed.join(", ")}`,
        );
      }
    }
    prev.current = { ...deps };
  }

  React.useEffect(() => {
    if (!IS_DEV || !settings.enabled || !settings.detailedLogging) return;
    const end =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const dur = end - lastRenderTs.current;
    if (dur >= settings.slowMs) {

      // eslint-disable-next-line no-console
      console.warn(
        `[perf] slow effect commit — ${label} took ${dur.toFixed(1)}ms`,
      );
    }
  });
}

/** Subscribe to profiler settings changes (dev only). */
export function usePerfSettings(): Settings {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    if (!IS_DEV) return;
    subs.add(force);
    return () => { subs.delete(force); };
  }, []);
  return settings;
}

/**
 * Dev-only, admin-scoped floating controls to adjust profiler thresholds
 * and toggle detailed logging. Renders nothing in production.
 */
export function PerfProfilerControls({ isAdmin }: { isAdmin: boolean }) {
  const s = usePerfSettings();
  const [open, setOpen] = React.useState(false);
  if (!IS_DEV || !isAdmin) return null;
  return (
    <div style={{ position: "fixed", bottom: 12, right: 12, zIndex: 9999 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            fontSize: 11, padding: "6px 10px", borderRadius: 999,
            background: "hsl(var(--card))", color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))", boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }}
          aria-label="Open performance profiler settings"
        >
          ⚙ perf {s.enabled ? "on" : "off"} · {s.slowMs}/{s.verySlowMs}ms
        </button>
      ) : (
        <div style={{
          width: 260, padding: 12, borderRadius: 10,
          background: "hsl(var(--card))", color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))", boxShadow: "0 6px 24px rgba(0,0,0,.2)",
          fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Perf profiler (dev)</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <input type="checkbox" checked={s.enabled} onChange={(e) => updatePerfSettings({ enabled: e.target.checked })} />
            Enable profiler
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <input type="checkbox" checked={s.detailedLogging} onChange={(e) => updatePerfSettings({ detailedLogging: e.target.checked })} />
            Detailed console logs
          </label>
          <label style={{ display: "block", marginBottom: 6 }}>
            Slow (ms): {s.slowMs}
            <input type="range" min={8} max={200} value={s.slowMs}
              onChange={(e) => updatePerfSettings({ slowMs: Number(e.target.value) })}
              style={{ width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 6 }}>
            Very slow (ms): {s.verySlowMs}
            <input type="range" min={16} max={500} value={s.verySlowMs}
              onChange={(e) => updatePerfSettings({ verySlowMs: Number(e.target.value) })}
              style={{ width: "100%" }} />
          </label>
          <button
            type="button"
            onClick={() => updatePerfSettings(DEFAULTS)}
            style={{ marginTop: 6, fontSize: 11, textDecoration: "underline" }}
          >
            Reset defaults
          </button>
          <p style={{ marginTop: 8, opacity: 0.7 }}>Never active in production builds.</p>
        </div>
      )}
    </div>
  );
}

