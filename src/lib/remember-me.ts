// "Remember me" implementation.
//
// The Supabase client always persists its session in localStorage (the
// generated client file is not editable). We layer a small guard on top:
//
// - When the user checks "Remember me", we clear the ephemeral flag so the
//   session stays in localStorage across browser restarts (default behavior).
// - When "Remember me" is unchecked, we mark the persisted session as
//   ephemeral. On the next fresh tab (i.e. after the browser or the tab was
//   fully closed) the guard wipes the token before any code reads it, so the
//   user is signed out. Same-tab refreshes still keep the session because
//   sessionStorage survives refresh but not tab close.

const EPHEMERAL_FLAG = "hvac:auth:ephemeral";
const TAB_ALIVE_FLAG = "hvac:auth:tab-alive";

function projectRef(): string | null {
  const url =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.SUPABASE_URL);
  if (!url) return null;
  const m = String(url).match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

function tokenKey(): string | null {
  const ref = projectRef();
  return ref ? `sb-${ref}-auth-token` : null;
}

/**
 * Run once at app boot, before any Supabase call. If the previous session was
 * marked ephemeral AND this is a brand-new tab (sessionStorage is empty),
 * wipe the persisted token so the user has to sign in again.
 */
export function applyEphemeralGuard(): void {
  if (typeof window === "undefined") return;
  try {
    const isEphemeral = localStorage.getItem(EPHEMERAL_FLAG) === "1";
    const tabAlive = sessionStorage.getItem(TAB_ALIVE_FLAG) === "1";
    if (isEphemeral && !tabAlive) {
      const key = tokenKey();
      if (key) localStorage.removeItem(key);
      localStorage.removeItem(EPHEMERAL_FLAG);
    }
    sessionStorage.setItem(TAB_ALIVE_FLAG, "1");
  } catch {
    /* storage disabled — ignore */
  }
}

/** Call after a successful sign-in / sign-up. */
export function setRememberMe(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (remember) localStorage.removeItem(EPHEMERAL_FLAG);
    else localStorage.setItem(EPHEMERAL_FLAG, "1");
    sessionStorage.setItem(TAB_ALIVE_FLAG, "1");
  } catch {
    /* ignore */
  }
}

/** Call on sign-out to reset the flags. */
export function clearRememberMe(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EPHEMERAL_FLAG);
  } catch {
    /* ignore */
  }
}
