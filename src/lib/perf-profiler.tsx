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

const ENABLED =
  typeof import.meta !== "undefined" &&
  !(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;

// A single 16ms budget frame. Anything above ~50ms is jank-visible.
const SLOW_COMMIT_MS = 32;
const VERY_SLOW_COMMIT_MS = 80;

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
  if (!ENABLED) return;
  const sample: Sample = {
    id,
    phase,
    actual: actualDuration,
    base: baseDuration,
    ts: Date.now(),
  };
  recent.push(sample);
  if (recent.length > 100) recent.shift();

  if (actualDuration >= SLOW_COMMIT_MS) {
    const level = actualDuration >= VERY_SLOW_COMMIT_MS ? "error" : "warn";
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
  if (!ENABLED) return <>{children}</>;
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

  if (ENABLED) {
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
    if (!ENABLED) return;
    const end =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const dur = end - lastRenderTs.current;
    if (dur >= SLOW_COMMIT_MS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[perf] slow effect commit — ${label} took ${dur.toFixed(1)}ms`,
      );
    }
  });
}
