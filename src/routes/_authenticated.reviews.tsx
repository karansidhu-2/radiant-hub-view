import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReview, listMyReviewableBookings } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";

export const Route = createFileRoute("/_authenticated/reviews")({
  component: MyReviewsPage,
});

function MyReviewsPage() {
  const listFn = useServerFn(listMyReviewableBookings);
  const createFn = useServerFn(createReview);
  const [rows, setRows] = useState<any[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { rating: number; comment: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => listFn().then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const submit = async (bookingId: string) => {
    const d = drafts[bookingId];
    if (!d || !d.rating) return toast.error("Please pick a rating");
    setSaving(bookingId);
    try {
      await createFn({ data: { booking_id: bookingId, rating: d.rating, comment: d.comment || null } });
      toast.success("Thanks for your review!");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (rows === null) return <div className="mx-auto max-w-3xl px-4 py-10">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">My Reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share your experience for completed service bookings.
      </p>

      {rows.length === 0 && (
        <Card className="mt-6"><CardContent className="p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">No completed bookings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Come back after your service is done.</p>
          <Link to="/services"><Button className="mt-4">Browse services</Button></Link>
        </CardContent></Card>
      )}

      <div className="mt-6 space-y-4">
        {rows.map((r) => {
          const d = drafts[r.id] ?? { rating: r.review?.rating ?? 0, comment: r.review?.comment ?? "" };
          return (
            <Card key={r.id} className="card-pop">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.service_name}</p>
                    <p className="text-xs text-muted-foreground">Serviced on {r.scheduled_date}</p>
                  </div>
                  {r.review && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Reviewed</span>}
                </div>

                <div className="mt-3">
                  <StarRating value={d.rating} onChange={(v) => setDrafts((p) => ({ ...p, [r.id]: { ...d, rating: v } }))} size={26} />
                </div>
                <Textarea
                  className="mt-3"
                  placeholder="Tell others about the technician, timing, and quality of work…"
                  value={d.comment}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, comment: e.target.value } }))}
                  maxLength={2000}
                  rows={3}
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={() => submit(r.id)} disabled={saving === r.id}>
                    {saving === r.id ? "Saving…" : r.review ? "Update review" : "Submit review"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
