import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Play } from "lucide-react";
import { resolveProductImageUrls, youtubeId, type MediaItem } from "@/lib/product-image";
import { DynamicIcon } from "@/components/DynamicIcon";

type Props = {
  /** Media gallery items (images + videos). */
  media?: MediaItem[] | null;
  /** Legacy single image path/URL — used as a fallback if `media` is empty. */
  fallbackImage?: string | null;
  /** Product name for alt text. */
  name: string;
  /** Icon name to render if no media at all. */
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

  if (items.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl gradient-cool shadow-elevated">
        <div className="absolute inset-0 grid place-items-center text-primary-foreground/95">
          <DynamicIcon name={emptyIcon} className="h-40 w-40 opacity-90" />
        </div>
      </div>
    );
  }

  const current = resolved[active];
  const go = (dir: number) => setActive((a) => (a + dir + resolved.length) % resolved.length);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted shadow-elevated group">
        {current ? (
          current.type === "video" ? (
            youtubeId(current.rendered) ? (
              <iframe
                key={current.rendered}
                src={`https://www.youtube.com/embed/${youtubeId(current.rendered)}?rel=0`}
                title={`${name} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <video
                key={current.rendered}
                src={current.rendered}
                poster={current.poster ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain bg-black"
              />
            )
          ) : (
            <img
              key={current.rendered}
              src={current.rendered}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          )
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-10 w-10" /></div>
        )}

        {resolved.length > 1 && (
          <>
            <button
              type="button" aria-label="Previous" onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            ><ChevronLeft className="h-5 w-5" /></button>
            <button
              type="button" aria-label="Next" onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 shadow-soft opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            ><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2.5 py-0.5 text-[11px] font-medium">
              {active + 1} / {resolved.length}
            </div>
          </>
        )}
      </div>

      {resolved.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {resolved.map((m, i) => (
            <button
              key={m.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show media ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                i === active ? "border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              {m.type === "video" ? (
                youtubeId(m.rendered) ? (
                  <>
                    <img
                      src={`https://i.ytimg.com/vi/${youtubeId(m.rendered)}/mqdefault.jpg`}
                      alt="" className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Play className="h-4 w-4" /></span>
                  </>
                ) : (
                  <>
                    <video src={m.rendered} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Play className="h-4 w-4" /></span>
                  </>
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
