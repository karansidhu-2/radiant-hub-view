import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
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

  return (
    <AuthContext.Provider
      value={{ session, user, loading, isAdmin, signOut: async () => {
        const { clearRememberMe } = await import("@/lib/remember-me");
        clearRememberMe();
        return supabase.auth.signOut();
      } }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
