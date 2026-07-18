import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Calendar, DollarSign, MapPin, MessageSquare, Package, Plus, Star, Trash2, User, Wallet, Wrench, Reply,
} from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";


export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n ?? 0));
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const hourLabel = (h: number | null | undefined) => {
  if (h == null) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:00 ${period}`;
};
const statusTone: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  shipped: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  refunded: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function AccountPage() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const bookingsQ = useQuery({
    queryKey: ["acct-bookings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*")
        .eq("user_id", uid).order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ordersQ = useQuery({
    queryKey: ["acct-orders", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*")
        .eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewsQ = useQuery({
    queryKey: ["acct-reviews", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*")
        .eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addressesQ = useQuery({
    queryKey: ["acct-addresses", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_addresses").select("*")
        .eq("user_id", uid).order("is_default", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileQ = useQuery({
    queryKey: ["acct-profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bookings = bookingsQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const reviews = reviewsQ.data ?? [];
  const addresses = addressesQ.data ?? [];

  // Live updates: refetch bookings/orders as their status changes.
  useRealtimeInvalidate(
    ["bookings", "orders"],
    [["acct-bookings", uid], ["acct-orders", uid]],
    { filter: uid ? `user_id=eq.${uid}` : undefined, enabled: !!uid },
  );


  const orderSpend = orders
    .filter((o: any) => !["cancelled", "refunded"].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const serviceSpend = bookings.reduce((s: number, b: any) => s + Number(b.service_charge ?? 0), 0);
  const totalSpent = orderSpend + serviceSpend;

  const repliesCount = reviews.filter((r: any) => r.admin_reply && r.admin_reply.trim().length > 0).length;
  const upcoming = bookings.filter(
    (b: any) => !["completed", "cancelled"].includes(b.status) && b.scheduled_date && new Date(b.scheduled_date) >= new Date(new Date().toDateString()),
  ).length;

  if (!user) return <div className="p-6 text-sm">Please sign in.</div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My account</h1>
          <p className="text-sm text-muted-foreground">
            {profileQ.data?.full_name || user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/book" search={{ service: undefined }}>
            <Button size="sm" className="gradient-cool text-primary-foreground">Book service</Button>
          </Link>
          <Link to="/shop"><Button size="sm" variant="outline">Shop</Button></Link>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Total spent" value={fmtMoney(totalSpent)} hint={`${orders.length} orders • ${bookings.length} bookings`} />
        <KpiCard icon={<Calendar className="h-4 w-4" />} label="Upcoming bookings" value={String(upcoming)} hint="Scheduled ahead" />
        <KpiCard icon={<Star className="h-4 w-4" />} label="Reviews left" value={String(reviews.length)} hint={`${repliesCount} replies from team`} />
        <KpiCard icon={<Package className="h-4 w-4" />} label="Orders total" value={fmtMoney(orderSpend)} hint={`Services: ${fmtMoney(serviceSpend)}`} />
      </div>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="bookings"><Wrench className="mr-1.5 h-3.5 w-3.5" />Bookings</TabsTrigger>
          <TabsTrigger value="orders"><Package className="mr-1.5 h-3.5 w-3.5" />Orders</TabsTrigger>
          <TabsTrigger value="addresses"><MapPin className="mr-1.5 h-3.5 w-3.5" />Addresses</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="mr-1.5 h-3.5 w-3.5" />Reviews & replies</TabsTrigger>
          <TabsTrigger value="profile"><User className="mr-1.5 h-3.5 w-3.5" />Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          <BookingsList rows={bookings} loading={bookingsQ.isLoading} />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersList rows={orders} loading={ordersQ.isLoading} />
        </TabsContent>
        <TabsContent value="addresses" className="mt-4">
          <AddressesPanel rows={addresses} uid={uid} loading={addressesQ.isLoading} />
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <ReviewsPanel rows={reviews} loading={reviewsQ.isLoading} />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <ProfilePanel uid={uid} email={user.email ?? ""} profile={profileQ.data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="card-pop">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
          {label}
        </div>
        <div className="mt-1.5 text-xl font-bold tracking-tight">{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone[status] ?? "bg-secondary text-secondary-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground">{icon}</span>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
        {action}
      </CardContent>
    </Card>
  );
}

function BookingsList({ rows, loading }: { rows: any[]; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length)
    return (
      <EmptyState
        icon={<Wrench className="h-5 w-5" />}
        title="No bookings yet"
        hint="Schedule an installation, repair, or tune-up to get started."
        action={<Link to="/book" search={{ service: undefined }}><Button size="sm" className="mt-1">Book now</Button></Link>}
      />
    );
  return (
    <div className="space-y-2">
      {rows.map((b) => (
        <Card key={b.id} className="card-pop">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.service_name}</span>
                <StatusBadge status={b.status} />
                <span className="text-[11px] text-muted-foreground">#{b.reference}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(b.scheduled_date)} · {hourLabel(b.scheduled_hour)}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{b.street}, {b.city} {b.state} {b.zip}</span>
                {b.technician && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{b.technician}</span>}
                {b.service_charge != null && <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{fmtMoney(b.service_charge)}</span>}
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Link to="/confirmation/$kind/$ref" params={{ kind: "booking", ref: b.reference }}>
                <Button size="sm" variant="outline">View</Button>
              </Link>
              {b.status === "completed" && (
                <Link to="/reviews"><Button size="sm">Review</Button></Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrdersList({ rows, loading }: { rows: any[]; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length)
    return (
      <EmptyState
        icon={<Package className="h-5 w-5" />}
        title="No orders yet"
        hint="Browse the shop for equipment, filters and accessories."
        action={<Link to="/shop"><Button size="sm" className="mt-1">Visit shop</Button></Link>}
      />
    );
  return (
    <div className="space-y-2">
      {rows.map((o) => (
        <Card key={o.id} className="card-pop">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Order {fmtMoney(o.total)}</span>
                <StatusBadge status={o.status} />
                <span className="text-[11px] text-muted-foreground">#{o.reference}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Placed {fmtDate(o.created_at)}</span>
                {o.scheduled_date && (
                  <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />Install {fmtDate(o.scheduled_date)} {hourLabel(o.scheduled_hour)}</span>
                )}
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.street}, {o.city} {o.state} {o.zip}</span>
                <span>Items {fmtMoney(o.subtotal)} + Install {fmtMoney(o.installation_total)}</span>
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Link to="/confirmation/$kind/$ref" params={{ kind: "order", ref: o.reference }}>
                <Button size="sm" variant="outline">View</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AddressesPanel({ rows, uid, loading }: { rows: any[]; uid: string; loading: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ label: "Home", street: "", city: "", state: "", zip: "", is_default: false });

  const openNew = () => { setEditing(null); setForm({ label: "Home", street: "", city: "", state: "", zip: "", is_default: rows.length === 0 }); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ label: a.label, street: a.street, city: a.city, state: a.state, zip: a.zip, is_default: a.is_default }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.street || !form.city || !form.state || !form.zip) throw new Error("All address fields are required");
      if (form.is_default) {
        await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", uid);
      }
      if (editing) {
        const { error } = await supabase.from("saved_addresses").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_addresses").insert({ ...form, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Address updated" : "Address saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["acct-addresses", uid] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Address removed");
      qc.invalidateQueries({ queryKey: ["acct-addresses", uid] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", uid);
      const { error } = await supabase.from("saved_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acct-addresses", uid] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Save addresses to book faster next time.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add address</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit address" : "Add address"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium">Label</label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home, Office…" />
              </div>
              <div>
                <label className="text-xs font-medium">Street</label>
                <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-medium">City</label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium">State</label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">ZIP</label>
                <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} maxLength={10} />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                Set as default address
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<MapPin className="h-5 w-5" />} title="No saved addresses" hint="Add your home or office to speed up booking." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className="card-pop">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.label}</span>
                      {a.is_default && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Default</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.street}<br />{a.city}, {a.state} {a.zip}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!a.is_default && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDefault.mutate(a.id)}>Set default</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(a)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => del.mutate(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsPanel({ rows, loading }: { rows: any[]; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length)
    return (
      <EmptyState
        icon={<MessageSquare className="h-5 w-5" />}
        title="No reviews yet"
        hint="After a completed service, share your experience."
        action={<Link to="/reviews"><Button size="sm" className="mt-1">Leave a review</Button></Link>}
      />
    );
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id} className="card-pop">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.service_name}</span>
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400" : "opacity-30"}`} />
                ))}
              </span>
              {!r.published && <Badge variant="secondary" className="text-[10px]">Awaiting moderation</Badge>}
              <span className="ml-auto text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</span>
            </div>
            {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{r.comment}</p>}
            {r.admin_reply && (
              <div className="mt-3 rounded-md border border-border bg-secondary/50 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Reply className="h-3.5 w-3.5" /> Reply from the team
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground">{fmtDate(r.admin_reply_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{r.admin_reply}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProfilePanel({ uid, email, profile }: { uid: string; email: string; profile: any }) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["acct-profile", uid] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:max-w-md">
        <div>
          <label className="text-xs font-medium">Email</label>
          <Input value={email} disabled />
        </div>
        <div>
          <label className="text-xs font-medium">Full name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
