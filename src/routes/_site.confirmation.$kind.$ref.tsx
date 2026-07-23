import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingByRef, getOrderByRef, claimGuestRecords } from "@/lib/hvac.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, MapPin, Calendar, Clock, UserPlus } from "lucide-react";
import { formatMoney } from "@/data/products";
import { InvoiceBadge } from "@/components/InvoiceBadge";
// jsPDF is dynamically imported inside downloadInvoicePDF so the ~400KB
// jspdf+html2canvas chunks only load when the user clicks "Download Invoice".

export const Route = createFileRoute("/_site/confirmation/$kind/$ref")({
  head: () => ({ meta: [{ title: "Confirmation — HVAC Pro" }, { name: "description", content: "Your HVAC Pro booking or order confirmation with reference number, status tracking, and downloadable invoice." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ConfirmationPage,
});


const fmtHour = (h: number) => `${h === 12 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

function statusColor(s: string) {
  return { pending: "secondary", confirmed: "default", in_progress: "default", scheduled: "default", completed: "default", installed: "default", cancelled: "destructive" }[s] || "secondary";
}

async function downloadInvoicePDF(kind: string, data: any) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(20); doc.text("HVAC Pro", 14, 20);
  doc.setFontSize(10); doc.text("Invoice / Confirmation", 14, 27);
  doc.setFontSize(12); doc.text(`Reference: ${data.reference}`, 14, 40);
  doc.text(`Status: ${String(data.status).toUpperCase()}`, 14, 48);
  doc.text(`Customer: ${data.full_name}`, 14, 56);
  doc.text(`Email: ${data.email}`, 14, 64);
  doc.text(`Phone: ${data.phone}`, 14, 72);
  doc.text(`Address: ${data.street}, ${data.city}, ${data.state} ${data.zip}`, 14, 80);
  if (data.scheduled_date) doc.text(`Scheduled: ${data.scheduled_date} at ${fmtHour(data.scheduled_hour ?? 0)}`, 14, 88);

  let y = 100;
  if (kind === "order" && data.items) {
    doc.setFontSize(13); doc.text("Items", 14, y); y += 8;
    doc.setFontSize(11);
    data.items.forEach((it: any) => {
      const line = `${it.product_name} × ${it.quantity}${it.include_installation ? " (+ install)" : ""}`;
      const total = (it.unit_price + (it.include_installation ? it.installation_fee : 0)) * it.quantity;
      doc.text(line, 14, y); doc.text(`$${total.toLocaleString()}`, 180, y, { align: "right" }); y += 7;
    });
    y += 4; doc.line(14, y, 196, y); y += 8;
    doc.text(`Subtotal: $${Number(data.subtotal).toLocaleString()}`, 180, y, { align: "right" }); y += 7;
    doc.text(`Installation: $${Number(data.installation_total).toLocaleString()}`, 180, y, { align: "right" }); y += 7;
    doc.setFontSize(13); doc.text(`Total: $${Number(data.total).toLocaleString()}`, 180, y, { align: "right" });
  } else if (kind === "booking") {
    doc.setFontSize(13); doc.text(`Service: ${data.service_name}`, 14, y);
  }
  doc.setFontSize(9); doc.setTextColor(120); doc.text("Thank you for choosing HVAC Pro. (800) 555-1234", 14, 280);
  doc.save(`hvacpro-${kind}-${data.reference}.pdf`);
}

function ConfirmationPage() {
  const { kind, ref } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const getBooking = useServerFn(getBookingByRef);
  const getOrder = useServerFn(getOrderByRef);
  const claimFn = useServerFn(claimGuestRecords);

  const load = async () => {
    setLoading(true);
    const res = kind === "order" ? await getOrder({ data: { reference: ref } }) : await getBooking({ data: { reference: ref } });
    setData(res);
    setLoading(false);
  };
  useEffect(() => { load(); }, [kind, ref]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  // If the guest signs in later, auto-claim their guest records by email.
  useEffect(() => {
    if (!authed || !data || data.user_id) return;
    claimFn({}).then((r) => {
      if ((r?.bookings ?? 0) + (r?.orders ?? 0) > 0) load();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, data?.user_id]);


  if (loading) return <div className="p-16 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-16 text-center">
    <p>Not found or you don't have access.</p>
    <Link to="/"><Button className="mt-4">Home</Button></Link>
  </div>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <div className="rounded-2xl bg-green-50 dark:bg-green-950/30 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-3 text-2xl font-bold">
          {kind === "order" ? "Order placed!" : "Booking confirmed!"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Reference <span className="font-mono font-semibold">{data.reference}</span></p>
        <p className="mt-2 text-sm">We'll call {data.phone} within 1 business hour to confirm.</p>
        <p className="mt-1 text-xs text-muted-foreground">A copy of this confirmation was sent to {data.email}.</p>
      </div>

      {authed === false && !data.user_id && (
        <Card className="mt-4 border-primary/40 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Create an account to track this {kind}</p>
                <p className="text-xs text-muted-foreground">Sign up with <span className="font-medium">{data.email}</span> and we'll link this {kind} — and any future ones — to your account automatically.</p>
              </div>
            </div>
            <Link
              to="/auth"
              search={{ redirect: `/confirmation/${kind}/${ref}` }}
              className="shrink-0"
            >
              <Button size="sm" className="gradient-cool text-primary-foreground">Create account</Button>
            </Link>
          </CardContent>
        </Card>
      )}


      <Card className="mt-6"><CardContent className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Status tracking</h2>
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceBadge invoice={data.invoice} />
            <Badge variant={statusColor(data.status) as any}>{String(data.status).replace("_", " ").toUpperCase()}</Badge>
          </div>
        </div>
        <StatusTimeline kind={kind} status={data.status} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load}>Refresh status</Button>
          {kind === "booking" && data.status === "completed" && (
            <Link to="/reviews"><Button size="sm">Leave a review</Button></Link>
          )}
        </div>
      </CardContent></Card>

      <Card className="mt-4"><CardContent className="p-6 space-y-3 text-sm">
        <h2 className="font-semibold mb-2">Details</h2>
        {data.service_name && <p><strong>Service:</strong> {data.service_name}</p>}
        {data.scheduled_date && (
          <p className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {data.scheduled_date}
            <Clock className="ml-2 h-4 w-4" /> {fmtHour(data.scheduled_hour ?? 0)}</p>
        )}
        <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> {data.street}, {data.city}, {data.state} {data.zip}</p>
        {kind === "order" && data.items && (
          <div className="mt-3 border-t pt-3">
            {data.items.map((it: any) => (
              <div key={it.id} className="flex justify-between py-1">
                <span>{it.product_name} × {it.quantity}{it.include_installation && " + install"}</span>
                <span className="font-semibold">{formatMoney((it.unit_price + (it.include_installation ? it.installation_fee : 0)) * it.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t pt-2 font-bold">
              <span>Total</span><span>{formatMoney(Number(data.total))}</span>
            </div>
          </div>
        )}
      </CardContent></Card>

      <div className="mt-6 flex gap-3">
        <Button onClick={() => downloadInvoicePDF(kind, data)} className="gradient-cool text-primary-foreground">
          <Download className="mr-2 h-4 w-4" /> Download invoice (PDF)
        </Button>
        <Link to="/"><Button variant="outline">Back home</Button></Link>
      </div>
    </section>
  );
}

function StatusTimeline({ kind, status }: { kind: string; status: string }) {
  const steps = kind === "order"
    ? ["pending", "confirmed", "scheduled", "installed"]
    : ["pending", "confirmed", "in_progress", "completed"];
  const idx = steps.indexOf(status);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div className={`h-2 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
          <span className={`text-xs whitespace-nowrap ${i <= idx ? "font-semibold" : "text-muted-foreground"}`}>{s.replace("_", " ")}</span>
        </div>
      ))}
    </div>
  );
}
