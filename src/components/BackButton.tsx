import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { label?: string; className?: string };

export function BackButton({ label = "Back", className }: Props) {
  const router = useRouter();
  const canGoBack =
    typeof window !== "undefined" && window.history.length > 1;

  const onClick = () => {
    if (canGoBack) router.history.back();
    else router.navigate({ to: "/" });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`gap-1 -ml-2 ${className ?? ""}`}
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Button>
  );
}
