import { Star, Sparkles } from "lucide-react";
import type { AutoRating } from "@/hooks/useAutoRatings";

function confidenceLabel(c: number): string {
  if (c >= 0.75) return "High confidence";
  if (c >= 0.4) return "Growing signal";
  if (c > 0) return "Early signal";
  return "New listing";
}

export function AutoRatingBadge({
  rating,
  compact = false,
}: {
  rating: AutoRating | undefined;
  compact?: boolean;
}) {
  if (!rating) return null;
  const stars = Number(rating.auto_rating).toFixed(1);
  const conf = confidenceLabel(Number(rating.auto_confidence));
  const summary =
    rating.related_review_count > 0
      ? `Auto-scored from ${rating.units_sold} unit${rating.units_sold === 1 ? "" : "s"} sold · ${rating.related_review_count} verified review${rating.related_review_count === 1 ? "" : "s"}`
      : rating.units_sold > 0
        ? `Auto-scored from ${rating.units_sold} unit${rating.units_sold === 1 ? "" : "s"} sold`
        : "Auto-scored — no orders yet";

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        title={summary}
        aria-label={`Auto rating ${stars} out of 5, ${conf.toLowerCase()}`}
      >
        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
        {stars}
        <Sparkles className="h-3 w-3 opacity-70" />
      </span>
    );
  }

  return (
    <div
      className="inline-flex flex-col gap-0.5 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200"
      aria-label={`Auto rating ${stars} out of 5`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
        <span>{stars} / 5</span>
        <Sparkles className="h-3.5 w-3.5 opacity-70" />
        <span className="text-xs font-normal opacity-80">Auto rating · {conf}</span>
      </div>
      <p className="text-[11px] opacity-80">{summary}</p>
    </div>
  );
}
