import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Keyboard, Maximize2, Play, X } from "lucide-react";
import { resolveProductImageUrls, youtubeId, type MediaItem } from "@/lib/product-image";
import { DynamicIcon } from "@/components/DynamicIcon";
import { decideSwipe, resolveAxisLock } from "@/lib/lightbox-swipe";
import { SmartImage } from "@/components/SmartImage";
import { cdnSrcSet, cdnUrl } from "@/lib/cdn-image";

/**
 * LCP preload widths + sizes MUST match the first <img> in the gallery so the
 * browser reuses the preloaded response instead of firing a second request.
 * Keep in sync with the non-`large` branch of `renderMain` below.
 */
const LCP_WIDTHS = [400, 600, 800, 1024, 1280];
const LCP_SIZES = "(min-width: 1024px) 60vw, 100vw";

/** Inject <link rel=preload as=image> for the first gallery image (AVIF + WebP). */
function useLcpImagePreload(url: string | undefined, isImage: boolean) {
  useEffect(() => {
    if (!url || !isImage) return;
    if (typeof document === "undefined") return;
    if (!/^https?:\/\//i.test(url)) return;

    const mk = (fmt: "avif" | "webp") => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.type = `image/${fmt}`;
      link.setAttribute("imagesrcset", cdnSrcSet(url, LCP_WIDTHS, fmt));
      link.setAttribute("imagesizes", LCP_SIZES);
      link.setAttribute("fetchpriority", "high");
      link.href = cdnUrl(url, { w: 800, fmt });
      document.head.appendChild(link);
      return link;
    };
    const links = [mk("avif"), mk("webp")];
    return () => { for (const l of links) l.remove(); };
  }, [url, isImage]);
}



type Props = {
  media?: MediaItem[] | null;
  fallbackImage?: string | null;
  name: string;
  emptyIcon?: string;
};

type Resolved = MediaItem & { rendered: string };

export function ProductGallery({ media, fallbackImage, name, emptyIcon = "Snowflake" }: Props) {
  const items = useMemo<MediaItem[]>(() => {
    const arr = Array.isArray(media) ? media.filter((m) => m && m.url) : [];
    if (arr.length > 0) return arr;
    if (fallbackImage) return [{ url: fallbackImage, type: "image" }];
    return [];
  }, [media, fallbackImage]);

  const [resolved, setResolved] = useState<Resolved[]>([]);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const helpId = useId();


  useEffect(() => {
    let alive = true;
    (async () => {
      const paths = items.map((m) => m.url);
      const map = await resolveProductImageUrls(paths);
      if (!alive) return;
      setResolved(items.map((m) => ({ ...m, rendered: map[m.url] ?? m.url })));
      setActive(0);
    })();
    return () => { alive = false; };
  }, [items]);

  // Preload the first (LCP) image at high priority, matching srcset/sizes below.
  const first = resolved[0];
  useLcpImagePreload(first?.rendered, first?.type !== "video");


  const total = resolved.length;
  const go = useCallback((dir: number) => {
    setActive((a) => (a + dir + total) % Math.max(total, 1));
  }, [total]);

  // Keyboard nav on the main viewer region
  const onViewerKey = useCallback((e: React.KeyboardEvent) => {
    if (total <= 1) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(total - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      if (e.currentTarget === e.target) { e.preventDefault(); setLightbox(true); }
    }
  }, [total, go]);

  const onThumbsKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(total - 1); }
  }, [total, go]);

  const openLightbox = useCallback(() => setLightbox(true), []);
  const closeLightbox = useCallback(() => setLightbox(false), []);
  const toggleHelp = useCallback(() => setShowHelp((s) => !s), []);
  const goPrev = useCallback(() => go(-1), [go]);
  const goNext = useCallback(() => go(1), [go]);

  const renderMain = useCallback((m: Resolved | undefined, opts?: { large?: boolean }) => {
    if (!m) return <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-10 w-10" aria-hidden /></div>;
    const idxLabel = `${name}, ${m.type === "video" ? "video" : "image"} ${active + 1} of ${total}`;
    if (m.type === "video") {
      const yt = youtubeId(m.rendered);
      if (yt) {
        return (
          <iframe
            key={m.rendered}
            src={`https://www.youtube.com/embed/${yt}?rel=0`}
            title={`${name} video ${active + 1} of ${total}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={opts?.large ? "h-full w-full" : "h-full w-full"}
          />
        );
      }
      return (
        <video
          key={m.rendered}
          src={m.rendered}
          poster={m.poster ?? undefined}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          aria-label={idxLabel}
          className={`h-full w-full ${opts?.large ? "object-contain" : "object-contain bg-black"}`}
        />
      );
    }
    return (
      <SmartImage
        key={m.rendered}
        src={m.rendered}
        alt={idxLabel}
        eager={active === 0 && !opts?.large}
        widths={opts?.large ? [640, 960, 1280, 1600, 1920] : LCP_WIDTHS}
        sizes={opts?.large ? "100vw" : LCP_SIZES}
        fit={opts?.large ? "inside" : "cover"}
        className={opts?.large
          ? "max-h-full max-w-full object-contain"
          : "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"}
      />
    );
  }, [active, total, name]);



  if (items.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl gradient-cool shadow-elevated" role="img" aria-label={`${name} (no media available)`}>
        <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
          <DynamicIcon name={emptyIcon} className="h-40 w-40 opacity-90" aria-hidden />
        </div>
      </div>
    );
  }

  const current = resolved[active];

  return (
    <div className="space-y-3">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={`${name} media gallery`}
        aria-describedby={helpId}
        tabIndex={0}
        onKeyDown={onViewerKey}
        className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted shadow-elevated group outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {current ? `${current.type === "video" ? "Video" : "Image"} ${active + 1} of ${total}` : ""}
        </div>
        {renderMain(current)}

        <button
          type="button"
          aria-label="Keyboard shortcuts"
          aria-expanded={showHelp}
          aria-controls={helpId}
          onClick={() => setShowHelp((s) => !s)}
          className="absolute left-2 top-2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Keyboard className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Open full screen"
          onClick={() => setLightbox(true)}
          className="absolute right-2 top-2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>


        {total > 1 && (
          <>
            <button
              type="button" aria-label={`Previous media (${active === 0 ? total : active} of ${total})`} onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
            ><ChevronLeft className="h-5 w-5" aria-hidden /></button>
            <button
              type="button" aria-label={`Next media (${active + 2 > total ? 1 : active + 2} of ${total})`} onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
            ><ChevronRight className="h-5 w-5" aria-hidden /></button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2.5 py-0.5 text-[11px] font-medium" aria-hidden>
              {active + 1} / {total}
            </div>
          </>
        )}
      </div>

      <div
        id={helpId}
        role="note"
        aria-label="Keyboard shortcuts for the media gallery"
        className={showHelp ? "rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground" : "sr-only"}
      >
        <p className="font-semibold text-foreground">Keyboard shortcuts</p>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          <li><kbd className="rounded border px-1">←</kbd> / <kbd className="rounded border px-1">→</kbd> Previous / next</li>
          <li><kbd className="rounded border px-1">Home</kbd> / <kbd className="rounded border px-1">End</kbd> First / last</li>
          <li><kbd className="rounded border px-1">Enter</kbd> or <kbd className="rounded border px-1">Space</kbd> Open full screen</li>
          <li><kbd className="rounded border px-1">Esc</kbd> Close full screen</li>
          <li className="sm:col-span-2">Touch: swipe left or right to change media in full screen.</li>
        </ul>
      </div>



      {total > 1 && (
        <div
          role="tablist"
          aria-label={`${name} media thumbnails`}
          onKeyDown={onThumbsKey}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {resolved.map((m, i) => {
            const isActive = i === active;
            return (
              <button
                key={m.url + i}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${m.type === "video" ? "Video" : "Image"} ${i + 1} of ${total}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                onDoubleClick={() => { setActive(i); setLightbox(true); }}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? "border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                {m.type === "video" ? (
                  youtubeId(m.rendered) ? (
                    <>
                      <img
                        src={`https://i.ytimg.com/vi/${youtubeId(m.rendered)}/mqdefault.jpg`}
                        alt="" className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/30 text-white" aria-hidden><Play className="h-4 w-4" /></span>
                    </>
                  ) : (
                    <>
                      <video src={m.rendered} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
                      <span className="absolute inset-0 grid place-items-center bg-black/30 text-white" aria-hidden><Play className="h-4 w-4" /></span>
                    </>
                  )
                ) : (
                  <img src={m.rendered} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {lightbox && (
        <Lightbox
          items={resolved}
          index={active}
          name={name}
          onClose={() => setLightbox(false)}
          onIndex={setActive}
          renderMain={renderMain}
        />
      )}
    </div>
  );
}

function Lightbox({
  items, index, name, onClose, onIndex, renderMain,
}: {
  items: Resolved[];
  index: number;
  name: string;
  onClose: () => void;
  onIndex: (i: number) => void;
  renderMain: (m: Resolved | undefined, opts?: { large?: boolean }) => React.ReactNode;
}) {
  const total = items.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const touchDelta = useRef({ x: 0, y: 0 });
  const swipeLocked = useRef<"h" | "v" | null>(null);
  const [dragX, setDragX] = useState(0);

  const go = useCallback((dir: number) => {
    if (total <= 1) return;
    onIndex((index + dir + total) % total);
  }, [index, total, onIndex]);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "Home") { e.preventDefault(); onIndex(0); }
      else if (e.key === "End") { e.preventDefault(); onIndex(total - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose, onIndex, total]);

  // Native listeners with {passive:false} so we can preventDefault during horizontal swipes
  useEffect(() => {
    const el = swipeAreaRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, t: performance.now() };
      touchDelta.current = { x: 0, y: 0 };
      swipeLocked.current = null;
      setDragX(0);
    };
    const onMove = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      touchDelta.current = { x: dx, y: dy };
      if (!swipeLocked.current) swipeLocked.current = resolveAxisLock(dx, dy);
      if (swipeLocked.current === "h") {
        e.preventDefault(); // block page scroll during horizontal drag
        setDragX(dx);
      }
    };
    const onEnd = () => {
      const start = touchStart.current;
      const { x: dx } = touchDelta.current;
      const locked = swipeLocked.current;
      touchStart.current = null;
      swipeLocked.current = null;
      setDragX(0);
      if (!start) return;
      const decision = decideSwipe({
        dx,
        elapsedMs: performance.now() - start.t,
        width: el.clientWidth || 1,
        lockedAxis: locked,
      });
      if (decision !== 0) go(decision);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [go]);



  const current = items[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} media viewer`}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 animate-in fade-in-0"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm font-medium" aria-live="polite">
          {current?.type === "video" ? "Video" : "Image"} {index + 1} of {total}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close full screen viewer"
          className="rounded-full bg-white/10 p-2 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div
        ref={swipeAreaRef}
        className="relative flex-1 select-none touch-pan-y overflow-hidden"
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center p-4 will-change-transform"
          style={{
            transform: dragX ? `translate3d(${dragX}px,0,0)` : undefined,
            transition: dragX ? "none" : "transform 200ms ease-out",
          }}
        >
          {renderMain(current, { large: true })}
        </div>


        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            ><ChevronLeft className="h-6 w-6" aria-hidden /></button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
            ><ChevronRight className="h-6 w-6" aria-hidden /></button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3">
          {items.map((m, i) => (
            <button
              key={m.url + i}
              type="button"
              aria-label={`Go to ${m.type === "video" ? "video" : "image"} ${i + 1}`}
              aria-current={i === index}
              onClick={() => onIndex(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors focus-visible:ring-2 focus-visible:ring-white ${
                i === index ? "border-white" : "border-white/30 hover:border-white/70"
              }`}
            >
              {m.type === "video" ? (
                youtubeId(m.rendered) ? (
                  <img src={`https://i.ytimg.com/vi/${youtubeId(m.rendered)}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={m.rendered} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
                )
              ) : (
                <img src={m.rendered} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
