import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListAllowlist, adminAddAllowlistEmail, adminRemoveAllowlistEmail } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  component: AdminsPage,
});

type Row = { id: string; email: string; created_at: string; registered: boolean };

function AdminsPage() {
  const list = useServerFn(adminListAllowlist);
  const add = useServerFn(adminAddAllowlistEmail);
  const remove = useServerFn(adminRemoveAllowlistEmail);
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try { setRows((await list()) as Row[]); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const res = await add({ data: { email } });
      toast.success(res.granted ? "Admin granted to existing user" : "Email added — admin on next signup");
      setEmail("");
      await refresh();
    } catch (err: any) { toast.error(err?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const onRemove = async (em: string) => {
    if (!confirm(`Remove admin access for ${em}?`)) return;
    try {
      await remove({ data: { email: em } });
      toast.success("Removed");
      await refresh();
    } catch (err: any) { toast.error(err?.message || "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Any email on this list gets the <b>admin</b> role automatically when they sign up.
          If they already have an account, they're granted admin immediately.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email" required placeholder="new-admin@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={busy} className="gradient-cool text-primary-foreground">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Invite admin
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No admin emails yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 max-w-full truncate font-medium">{r.email}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.registered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {r.registered ? "Active" : "Pending signup"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Added {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onRemove(r.email)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
