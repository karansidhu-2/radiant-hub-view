import { Link } from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw, WifiOff, Search, ShieldAlert, ServerCrash, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { PermissionErrorState, isPermissionError } from "@/components/PermissionErrorState";

type Tone = "danger" | "warning" | "info";

interface ErrorShellProps {
  code?: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
  details?: ReactNode;
}

const toneRing: Record<Tone, string> = {
  danger: "from-rose-500/20 via-orange-500/10 to-transparent ring-rose-500/30 text-rose-500",
  warning: "from-amber-500/20 via-yellow-500/10 to-transparent ring-amber-500/30 text-amber-500",
  info: "from-sky-500/20 via-indigo-500/10 to-transparent ring-sky-500/30 text-sky-500",
};

export function ErrorShell({ code, title, description, icon, tone = "danger", actions, details }: ErrorShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Ambient glow */}
      <div aria-hidden className={`pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-radial ${toneRing[tone].split(" ").slice(0, 3).join(" ")} blur-3xl opacity-60`} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,theme(colors.foreground/6)_1px,transparent_0)] [background-size:24px_24px]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-8 shadow-xl backdrop-blur-md animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-inset ${toneRing[tone].split(" ").slice(3).join(" ")} bg-background/60`}>
            {icon}
          </div>

          {code ? (
            <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Error {code}
            </p>
          ) : null}

          <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {actions}
          </div>

          {details ? (
            <div className="mt-6 rounded-lg border border-border/50 bg-muted/40 p-3 text-left">
              {details}
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need help?{" "}
          <Link to="/contact" className="font-medium text-foreground underline-offset-4 hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- 404 ------------------------------- */
export function NotFoundPage() {
  return (
    <ErrorShell
      code="404"
      tone="info"
      icon={<Search className="h-7 w-7" />}
      title="We couldn't find that page"
      description="The link may be broken, the page may have moved, or you may have mistyped the URL. Let's get you back on track."
      actions={
        <>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
          >
            <Home className="h-4 w-4" /> Go home
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Browse shop
          </Link>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            View services
          </Link>
        </>
      }
    />
  );
}

/* ----------------------- Generic error boundary ----------------------- */
interface GenericErrorProps {
  error: Error;
  reset?: () => void;
  onRetry?: () => void;
}

export function GenericErrorPage({ error, reset, onRetry }: GenericErrorProps) {
  const message = (error?.message ?? "").toString();
  const isNetwork = /network|fetch|failed to fetch|load failed/i.test(message);
  const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;

  if (isNetwork && typeof navigator !== "undefined" && !navigator.onLine) {
    return <OfflinePage onRetry={onRetry ?? reset} />;
  }

  if (status === 401 || status === 403) return <UnauthorizedPage />;
  if (status === 500 || status === 502 || status === 503 || status === 504) return <ServerErrorPage error={error} onRetry={onRetry ?? reset} />;

  return (
    <ErrorShell
      code={status ? String(status) : "Oops"}
      tone="danger"
      icon={<AlertTriangle className="h-7 w-7" />}
      title="Something went wrong"
      description="An unexpected error stopped this page from loading. You can try again or head back home."
      actions={
        <>
          <button
            onClick={() => (onRetry ?? reset)?.()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" /> Go home
          </Link>
        </>
      }
      details={
        message ? (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
              {message.slice(0, 800)}
            </pre>
          </details>
        ) : null
      }
    />
  );
}

/* ---------------------------- 500 / server ---------------------------- */
export function ServerErrorPage({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <ErrorShell
      code="500"
      tone="warning"
      icon={<ServerCrash className="h-7 w-7" />}
      title="Our servers are having a moment"
      description="We're working on it. Please try again in a few seconds, or come back shortly."
      actions={
        <>
          <button
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" /> Home
          </Link>
        </>
      }
      details={
        error?.message && import.meta.env.DEV ? (
          <details className="group">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <p className="mt-2 break-words text-[11px] text-muted-foreground/80 font-mono">
              {error.message.slice(0, 240)}
            </p>
          </details>
        ) : null
      }
    />
  );
}

/* ------------------------- 401 / 403 unauthorized ------------------------- */
export function UnauthorizedPage() {
  return (
    <ErrorShell
      code="403"
      tone="warning"
      icon={<ShieldAlert className="h-7 w-7" />}
      title="You don't have access to this page"
      description="This area is restricted. Sign in with an authorized account or head back to a page you can view."
      actions={
        <>
          <Link
            to="/auth"
            search={{ redirect: "/" }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            Sign in
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" /> Go home
          </Link>
        </>
      }
    />
  );
}

/* ------------------------------ Offline ------------------------------ */
export function OfflinePage({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorShell
      tone="info"
      icon={<WifiOff className="h-7 w-7" />}
      title="You're offline"
      description="We can't reach the internet right now. Check your Wi-Fi or mobile data — we'll pick up right where you left off once you're back."
      actions={
        <>
          <button
            onClick={() => {
              if (onRetry) onRetry();
              else if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <button
            onClick={() => (typeof window !== "undefined" ? window.history.back() : undefined)}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </>
      }
      details={
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• Check your Wi-Fi or mobile data connection</li>
          <li>• Disable airplane mode if it's on</li>
          <li>• Move to a location with better signal</li>
        </ul>
      }
    />
  );
}
