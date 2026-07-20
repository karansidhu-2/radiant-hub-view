import { createFileRoute } from "@tanstack/react-router";
import { OfflinePage } from "@/components/error-pages/ErrorPages";

export const Route = createFileRoute("/_site/offline")({
  head: () => ({
    meta: [
      { title: "You're offline — HVAC Pro" },
      { name: "description", content: "You appear to be offline. Reconnect to keep browsing HVAC Pro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfflineRoute,
});

function OfflineRoute() {
  return <OfflinePage />;
}
