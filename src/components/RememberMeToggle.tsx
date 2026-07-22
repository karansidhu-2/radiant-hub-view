import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getRememberMe, setRememberMe } from "@/lib/remember-me";

/**
 * Post-login preference toggle for "Keep me signed in".
 * Off = session ends when the browser/tab closes; refreshes still work.
 * On  = session persists across browser restarts (default).
 */
export function RememberMeToggle({ className }: { className?: string }) {
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    setRemember(getRememberMe());
  }, []);

  const onChange = (next: boolean) => {
    setRemember(next);
    setRememberMe(next);
    toast.success(
      next
        ? "Staying signed in on this device."
        : "You'll be signed out when this browser closes.",
    );
  };

  return (
    <div
      className={
        "flex items-start justify-between gap-4 rounded-lg border p-4 " +
        (className ?? "")
      }
    >
      <div className="space-y-1">
        <Label htmlFor="keep-signed-in" className="text-base font-medium">
          Keep me signed in
        </Label>
        <p className="text-sm text-muted-foreground">
          When off, you'll be signed out automatically once this browser is
          fully closed. Refreshing the page still keeps you signed in.
        </p>
      </div>
      <Switch
        id="keep-signed-in"
        checked={remember}
        onCheckedChange={onChange}
        aria-label="Keep me signed in"
      />
    </div>
  );
}
