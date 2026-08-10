import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

export function PullToRefreshIndicator({ pull, refreshing, threshold }: { pull: number; refreshing: boolean; threshold: number }) {
  if (pull === 0 && !refreshing) return null;
  const progress = Math.min(1, pull / threshold);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(${Math.min(pull, threshold + 20)}px)`, transition: refreshing ? "transform 200ms ease" : "none" }}
    >
      <div className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-background/95 shadow-md ring-1 ring-border">
        <RefreshCw
          className={`h-4 w-4 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
        />
      </div>
    </div>
  );
}
