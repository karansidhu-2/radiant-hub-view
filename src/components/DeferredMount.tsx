import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts `children` only once the placeholder scrolls near the viewport
 * (or after the browser goes idle). Keeps below-the-fold interactive
 * widgets out of the critical hydration path, which lowers TBT/INP
 * without affecting server-rendered content above the fold.
 *
 * Use ONLY for interactive widgets whose text does not need to be
 * crawlable — SEO-relevant copy must stay server-rendered.
 */
export function DeferredMount({
  children,
  fallback = null,
  rootMargin = "300px",
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);

    // Safety net: mount on idle even if the sentinel never intersects.
    const idle = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    const timer = idle
      ? idle(() => setShow(true), { timeout: 4000 })
      : window.setTimeout(() => setShow(true), 3000);

    return () => {
      io.disconnect();
      const cancelIdle = (window as unknown as {
        cancelIdleCallback?: (id: number) => void;
      }).cancelIdleCallback;
      if (idle && cancelIdle) cancelIdle(timer as number);
      else window.clearTimeout(timer as number);
    };
  }, [show, rootMargin]);

  return <div ref={ref}>{show ? children : fallback}</div>;
}

export default DeferredMount;
