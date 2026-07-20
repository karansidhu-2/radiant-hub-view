import { Link } from "@tanstack/react-router";
import { LockKeyhole, RefreshCw, LifeBuoy, LogIn } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

/**
 * Recognizes Supabase/PostgREST permission failures.
 * PostgREST returns error code 42501 or messages like
 *   "permission denied for table X"
 *   "permission denied for function Y"
 *   "new row violates row-level security policy"
 * Also matches HTTP 401/403 responses.
 */
export function isPermissionError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; status?: number; statusCode?: number; message?: string };
  if (e.code === "42501" || e.code === "PGRST301" || e.code === "PGRST302") return true;
  if (e.status === 401 || e.status === 403 || e.statusCode === 401 || e.statusCode === 403) return true;
  const msg = (e.message ?? String(err)).toLowerCase();
  return (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("insufficient_privilege") ||
    msg.includes("not authorized") ||
    msg.includes("unauthorized")
  );
}

interface Props {
  /** Optional short label of the action that failed, e.g. "load bookings". */
  action?: string;
  /** Retry the failed request. If omitted, the retry button is hidden. */
  onRetry?: () => void;
  /** Show as a compact inline card (default) or full-width block. */
  variant?: "inline" | "block";
  /** Extra technical hint shown in dev builds only. */
  error?: unknown;
}

/**
 * Friendly UI when an RPC / DB call is rejected by RLS or grants.
 * Explains what likely happened and offers retry, sign-in, and support.
 */
export function PermissionErrorState({ action, onRetry, variant = "inline", error }: Props) {
  const { user } = useAuthContext();
  const signedIn = Boolean(user);

  const title = signedIn
    ? "You don't have permission for this"
    : "Please sign in to continue";

  const description = signedIn
    ? `Your account isn't authorized to ${action ?? "perform this action"}. If you believe this is a mistake, retry in a moment or contact support — an admin can review your access.`
    : `You need to be signed in to ${action ?? "view this"}. Sign in and try again.`;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="permission-error"
      className={`${
        variant === "block" ? "w-full" : "mx-auto max-w-lg"
      } rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-300`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
            ) : null}
            {!signedIn ? (
              <Link
                to="/auth"
                search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
              </Link>
            ) : null}
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Contact support
            </Link>
          </div>

          {import.meta.env.DEV && error ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Technical details (dev only)
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-border/50 bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
                {String((error as { message?: string })?.message ?? error).slice(0, 500)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PermissionErrorState;
