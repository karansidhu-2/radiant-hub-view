import { createFileRoute } from "@tanstack/react-router";
import { processDueEmails } from "@/lib/email-outbox.server";

// Public webhook path (bypasses auth on published sites).
// Called by pg_cron every minute to drain the email outbox with retries.
export const Route = createFileRoute("/api/public/hooks/process-email-outbox")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processDueEmails();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
