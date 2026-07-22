import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { setRememberMe } from "@/lib/remember-me";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
    expired: s.expired === 1 || s.expired === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — HVAC Pro" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, expired } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem("hvac:auth:expired") === "1";
      if (flagged) sessionStorage.removeItem("hvac:auth:expired");
    } catch { /* ignore */ }
    if (expired || flagged) {
      toast.error("Your session has expired. Please log in again.");
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: redirect as any, replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [redirect, navigate, expired]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setRememberMe(remember);
      navigate({ to: redirect as any, replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Checking your session…</span>
        </div>
      </div>
    );
  }


  return (
    <section className="mx-auto max-w-md px-4 py-16 md:px-6">
      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book installations and track your orders.
          </p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Password</Label>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(v === true)}
                aria-label="Remember me"
              />
              <span>
                Remember me
                <span className="ml-1 text-xs text-muted-foreground">
                  {remember ? "(stay signed in on this device)" : "(sign out when I close the browser)"}
                </span>
              </span>
            </label>
            <Button type="submit" disabled={busy} className="gradient-cool text-primary-foreground">
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </section>
  );
}
