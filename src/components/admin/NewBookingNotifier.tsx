import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Bell from "lucide-react/dist/esm/icons/bell";
import BellOff from "lucide-react/dist/esm/icons/bell-off";
import BellRing from "lucide-react/dist/esm/icons/bell-ring";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

/**
 * Subscribes to new bookings and fires:
 *  - A toast in-app (always)
 *  - A Web Notification when the tab is hidden/backgrounded (if permission granted)
 * Admins can toggle permission from the small bell control.
 */
export function NewBookingNotifier() {
  const navigate = useNavigate();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof window === "undefined" || !("Notification" in window)
      ? "unsupported"
      : Notification.permission,
  );
  const bootRef = useRef(false);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    const channel = supabase
      .channel("admin-new-bookings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          const b: any = payload.new || {};
          const title = "New booking received";
          const body = `${b.customer_name ?? "Customer"} · ${b.service_slug ?? "service"}${
            b.scheduled_date ? ` · ${b.scheduled_date} ${b.scheduled_time ?? ""}` : ""
          }`;

          // Always show an in-app toast
          toast.success(title, {
            description: body,
            action: {
              label: "Open",
              onClick: () => navigate({ to: "/admin/bookings" }),
            },
          });

          // Fire an OS-level notification only when the tab is hidden/backgrounded
          const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
          if (
            hidden &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const n = new Notification(title, {
                body,
                tag: `booking-${b.id ?? Date.now()}`,
                icon: "/favicon.ico",
              });
              n.onclick = () => {
                window.focus();
                navigate({ to: "/admin/bookings" });
                n.close();
              };
            } catch {
              /* noop */
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  if (perm === "unsupported") return null;

  const request = async () => {
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") toast.success("Push notifications enabled");
      else if (p === "denied") toast.error("Notifications blocked in browser settings");
    } catch {
      /* noop */
    }
  };

  const Icon = perm === "granted" ? BellRing : perm === "denied" ? BellOff : Bell;
  const label = perm === "granted" ? "Alerts on" : perm === "denied" ? "Blocked" : "Enable alerts";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={perm === "granted" ? undefined : request}
      className="gap-1"
      title="Get OS notifications for new bookings when this tab is in the background"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
