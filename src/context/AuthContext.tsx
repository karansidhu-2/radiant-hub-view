import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearRememberMe, hardClearAuthStorage, isPersistedSessionExpired } from "@/lib/remember-me";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // If a persisted token has already expired, wipe storage BEFORE Supabase
    // reads it — avoids a brief signed-in flash then a spurious refresh loop.
    if (isPersistedSessionExpired()) {
      hardClearAuthStorage();
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem("hvac:auth:expired", "1"); } catch { /* ignore */ }
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      // Refresh failed / token revoked → clean everything out.
      if (event === "SIGNED_OUT" && !s) {
        hardClearAuthStorage();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data: hasAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (cancelled) return;
      if (hasAdmin) { setIsAdmin(true); return; }
      const email = user.email?.toLowerCase();
      if (!email) { setIsAdmin(false); return; }
      const { data: allow } = await supabase
        .from("admin_allowlist")
        .select("email")
        .ilike("email", email)
        .maybeSingle();
      if (cancelled) return;
      if (allow) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
        if (!cancelled) setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const signOut = async () => {
    clearRememberMe();
    let result: { error: any } = { error: null };
    try {
      result = await supabase.auth.signOut();
    } catch (err) {
      result = { error: err };
    }
    // Belt-and-braces: purge both storages regardless of Supabase's response.
    hardClearAuthStorage();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    if (typeof window !== "undefined") {
      // Full navigation guarantees every provider/cache is torn down cleanly.
      window.location.assign("/");
    }
    return result;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
