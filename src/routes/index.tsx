import { createFileRoute } from "@tanstack/react-router";
import XeroHero from "@/components/XeroHero";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <XeroHero />;
}
