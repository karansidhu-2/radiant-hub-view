import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReview, listMyReviewableBookings } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { useAuthContext } from "@/context/AuthContext";
import { toast } from "sonner";
import { MessageSquarePlus, CheckCircle2 } from "lucide-react";

export function HomeQuickReview() {
  const { user } = useAuthContext();
  const listFn = useServerFn(listMyReviewableBookings);
  const createFn = useServerFn(createReview);
  const [rows, setRows] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) { setRows([]); return; }
    listFn()
      .then((r: any[]) => {
        const pending = (r ?? []).filter((b) => !b.review);
        setRows(pending);
        if (pending[0]) setSelected(pending[0].id);
      })
      .catch(() => setRows([]));
  }, [user, listFn]);

  const submit = async () => {
    if (!selected) return toast.error("Select a booking");
    if (!rating) return toast.error("Please pick a rating");
    setSaving(true);
    try {
      await createFn({ data: { booking_id: selected, rating, comment: comment || null } });
      toast.success("Thanks for your review!");
      setDone(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <Card className="card-pop border-primary/20">
        <CardContent className="p-6 md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold md:text-xl">Leave your own review</h3>
          </div>

          {!user && (
            <div className="text-sm text-muted-foreground">
              <p>Sign in to share your experience after a completed service.</p>
              <Link to="/auth"><Button className="mt-4">Sign in to review</Button></Link>
            </div>
          )}

          {user && rows !== null && rows.length === 0 && !done && (
            <div className="text-sm text-muted-foreground">
              <p>You'll be able to leave a review once a booking is marked completed.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/book" search={{ service: undefined }}><Button>Book a service</Button></Link>
                <Link to="/reviews"><Button variant="outline">Manage my reviews</Button></Link>
              </div>
            </div>
          )}

          {user && rows && rows.length > 0 && !done && (
            <div className="space-y-4">
              {rows.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Which service?</label>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>{r.service_name} — {r.scheduled_date}</option>
                    ))}
                  </select>
                </div>
              )}
              {rows.length === 1 && (
                <p className="text-sm text-muted-foreground">
                  Reviewing: <span className="font-medium text-foreground">{rows[0].service_name}</span> · {rows[0].scheduled_date}
                </p>
              )}
              <StarRating value={rating} onChange={setRating} size={28} />
              <Textarea
                placeholder="How was the tech, timing, and quality of work?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={3}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Link to="/reviews"><Button variant="outline">See all my reviews</Button></Link>
                <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit review"}</Button>
              </div>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Thanks — your review has been submitted.</span>
              <Link to="/reviews" className="ml-2 underline">View</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
