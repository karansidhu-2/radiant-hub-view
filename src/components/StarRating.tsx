import { Star } from "lucide-react";

export function StarRating({
  value, onChange, size = 18, readOnly = false,
}: { value: number; onChange?: (v: number) => void; size?: number; readOnly?: boolean }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const Btn: any = readOnly ? "span" : "button";
        return (
          <Btn
            key={n}
            type={readOnly ? undefined : "button"}
            onClick={readOnly ? undefined : () => onChange?.(n)}
            aria-label={readOnly ? `${value} out of 5` : `Rate ${n}`}
            className={readOnly ? "" : "cursor-pointer transition-transform hover:scale-110"}
          >
            <Star
              width={size}
              height={size}
              className={filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
            />
          </Btn>
        );
      })}
    </div>
  );
}
