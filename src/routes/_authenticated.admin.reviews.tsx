import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adminListReviews, adminSetReviewPublished, adminDeleteReview, adminReplyReview,
  adminBulkModerateReviews,
} from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Star, Eye, EyeOff, Trash2, MessageSquare, Search, FileText, MessageSquareOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: AdminReviews,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Review = {
  id: string; rating: number; comment: string | null; published: boolean;
  admin_reply: string | null; admin_reply_at: string | null; admin_note: string | null;
  service_slug: string | null; service_name: string; booking_id: string;
  user_id: string; created_at: string; author: string; author_email: string;
};

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

function AdminReviews() {
  const list = useServerFn(adminListReviews);
  const setPub = useServerFn(adminSetReviewPublished);
  const del = useServerFn(adminDeleteReview);
  const reply = useServerFn(adminReplyReview);
  const bulk = useServerFn(adminBulkModerateReviews);
  const qc = useQueryClient();

  const [status, setStatus] = useState<"all" | "published" | "hidden">("all");
  const [q, setQ] = useState("");
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews", status, q],
    queryFn: () => list({ data: { status, q } }) as Promise<Review[]>,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const allSelected = reviews.length > 0 && reviews.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(reviews.map((r) => r.id)));

  const [editing, setEditing] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const openReply = (r: Review) => { setEditing(r); setReplyText(r.admin_reply ?? ""); setNoteText(r.admin_note ?? ""); };

  const stats = useMemo(() => {
    const total = reviews.length;
    const pub = reviews.filter((r) => r.published).length;
    const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    return { total, pub, hidden: total - pub, avg };
  }, [reviews]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-reviews"] });

  const pubMut = useMutation({
    mutationFn: (p: { id: string; published: boolean }) => setPub({ data: p }),
    onSuccess: (_d, v) => { toast.success(v.published ? "Review approved" : "Review hidden"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Review deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const replyMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await reply({ data: { id: editing.id, reply: replyText.trim() || null, note: noteText.trim() || null } });
    },
    onSuccess: () => { toast.success("Response saved"); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });
  const bulkMut = useMutation({
    mutationFn: (action: "approve" | "hide" | "delete" | "clear_reply") =>
      bulk({ data: { ids: Array.from(selected), action } }) as Promise<{ count: number }>,
    onSuccess: (res, action) => {
      toast.success(`${action.replace("_", " ")}: ${res.count} review(s)`);
      setSelected(new Set()); invalidate();
      setBulkConfirm(null); setBulkAck(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  type BulkAction = "approve" | "hide" | "delete" | "clear_reply";
  const [bulkConfirm, setBulkConfirm] = useState<BulkAction | null>(null);
  const [bulkAck, setBulkAck] = useState(false);
  const openBulk = (action: BulkAction) => {
    if (!selected.size) return;
    setBulkAck(false);
    setBulkConfirm(action);
  };

  const BULK_META: Record<BulkAction, { title: string; verb: string; body: string; destructive: boolean; ack: string }> = {
    approve:     { title: "Approve reviews",   verb: "Approve",      body: "These reviews will be published and visible to customers.",   destructive: false, ack: "I want to publish these reviews." },
    hide:        { title: "Hide reviews",      verb: "Hide",         body: "These reviews will be hidden from public service pages.",     destructive: false, ack: "I want to hide these reviews." },
    clear_reply: { title: "Clear replies",     verb: "Clear replies", body: "Public admin replies on these reviews will be removed. Ratings and comments stay.", destructive: false, ack: "I want to clear the public replies." },
    delete:      { title: "Delete reviews",    verb: "Delete",       body: "These reviews will be permanently deleted. This cannot be undone.", destructive: true, ack: "I understand this permanently deletes the selected reviews." },
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Review Moderation</h1>
          <p className="text-sm text-muted-foreground">Approve, hide, delete or respond to customer reviews.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/reviews/audit"><FileText className="mr-1.5 h-4 w-4" />Audit log</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Published", value: stats.pub },
          { label: "Hidden", value: stats.hidden },
          { label: "Avg rating", value: stats.avg ? stats.avg.toFixed(2) : "—" },
        ].map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-bold">{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["all","published","hidden"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 text-sm rounded capitalize ${status === s ? "bg-primary text-primary-foreground" : ""}`}>{s}</button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search author, service, comment…" className="h-9 pl-8" />
        </div>
      </div>

      {reviews.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span>{selected.size ? `${selected.size} selected` : "Select all"}</span>
            </label>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" disabled={!selected.size || bulkMut.isPending}
                onClick={() => openBulk("approve")}>
                <Eye className="mr-1 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size || bulkMut.isPending}
                onClick={() => openBulk("hide")}>
                <EyeOff className="mr-1 h-3.5 w-3.5" />Hide
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size || bulkMut.isPending}
                onClick={() => openBulk("clear_reply")}>
                <MessageSquareOff className="mr-1 h-3.5 w-3.5" />Clear replies
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                disabled={!selected.size || bulkMut.isPending} onClick={() => openBulk("delete")}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No reviews match this filter.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="card-pop">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox className="mt-1" checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{r.author}</span>
                        <Stars n={r.rating} />
                        <Badge variant={r.published ? "default" : "secondary"}>{r.published ? "Published" : "Hidden"}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.author_email && <span>{r.author_email} · </span>}
                        {r.service_name} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => pubMut.mutate({ id: r.id, published: !r.published })}>
                      {r.published ? <><EyeOff className="mr-1 h-3.5 w-3.5" />Hide</> : <><Eye className="mr-1 h-3.5 w-3.5" />Approve</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openReply(r)}>
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />{r.admin_reply ? "Edit reply" : "Reply"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Delete this review permanently?")) delMut.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {r.comment && <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary/40 p-3 text-sm">{r.comment}</p>}
                {r.admin_reply && (
                  <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-primary">Public reply</p>
                    <p className="mt-1 whitespace-pre-wrap">{r.admin_reply}</p>
                  </div>
                )}
                {r.admin_note && (
                  <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                    <span className="font-semibold uppercase text-amber-700 dark:text-amber-300">Internal note: </span>{r.admin_note}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reply to review</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-md bg-secondary/40 p-3 text-sm">
                <div className="flex items-center gap-2"><span className="font-semibold">{editing.author}</span><Stars n={editing.rating} /></div>
                {editing.comment && <p className="mt-1 text-xs">{editing.comment}</p>}
              </div>
              <div>
                <label className="text-xs font-medium">Public reply (shown on service page)</label>
                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} maxLength={2000}
                  placeholder="Thanks for your feedback…" />
              </div>
              <div>
                <label className="text-xs font-medium">Internal note (admins only)</label>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} maxLength={2000} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => replyMut.mutate()} disabled={replyMut.isPending}>{replyMut.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bulkConfirm} onOpenChange={(o) => { if (!o) { setBulkConfirm(null); setBulkAck(false); } }}>
        <DialogContent>
          {bulkConfirm && (
            <>
              <DialogHeader>
                <DialogTitle className={BULK_META[bulkConfirm].destructive ? "text-destructive" : ""}>
                  {BULK_META[bulkConfirm].title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className={`rounded-md border p-3 ${BULK_META[bulkConfirm].destructive ? "border-destructive/40 bg-destructive/5" : "border-border bg-secondary/40"}`}>
                  <p className="text-sm">
                    You are about to <span className="font-semibold">{BULK_META[bulkConfirm].verb.toLowerCase()}</span>{" "}
                    <span className="font-semibold">{selected.size}</span> review{selected.size === 1 ? "" : "s"}.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{BULK_META[bulkConfirm].body}</p>
                </div>
                <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                  <Checkbox checked={bulkAck} onCheckedChange={(v) => setBulkAck(v === true)} className="mt-0.5" />
                  <span>{BULK_META[bulkConfirm].ack}</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBulkConfirm(null); setBulkAck(false); }}>Cancel</Button>
                <Button
                  variant={BULK_META[bulkConfirm].destructive ? "destructive" : "default"}
                  disabled={!bulkAck || bulkMut.isPending}
                  onClick={() => bulkMut.mutate(bulkConfirm)}>
                  {bulkMut.isPending ? "Applying…" : `${BULK_META[bulkConfirm].verb} ${selected.size}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
