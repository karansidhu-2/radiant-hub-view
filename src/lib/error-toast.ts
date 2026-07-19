import { toast } from "sonner";
import { reportLovableError } from "./lovable-error-reporting";

/**
 * Extracts a human-readable message from any error shape (Error, Supabase
 * PostgrestError, thrown Response, string, unknown).
 */
export function toErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const anyErr = err as {
      message?: unknown;
      error_description?: unknown;
      error?: unknown;
      hint?: unknown;
      details?: unknown;
      statusText?: unknown;
    };
    const raw =
      anyErr.message ??
      anyErr.error_description ??
      anyErr.error ??
      anyErr.hint ??
      anyErr.details ??
      anyErr.statusText;
    if (typeof raw === "string" && raw.trim()) return raw;
    try {
      return JSON.stringify(err);
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

/** Show a toast + report the error. Safe for use in mutation onError/catch. */
export function handleError(err: unknown, opts: { title?: string; context?: Record<string, unknown> } = {}) {
  const message = toErrorMessage(err, opts.title ?? "Something went wrong");
  try {
    toast.error(opts.title ?? "Something went wrong", { description: message });
  } catch {
    /* toast may not be mounted yet */
  }
  reportLovableError(err, { source: "handleError", ...(opts.context ?? {}) });
}
