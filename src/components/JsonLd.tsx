import { useEffect } from "react";

/** Inject a JSON-LD schema.org script and clean up on unmount. */
export function JsonLd({ id, data }: { id: string; data: Record<string, unknown> }) {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = `jsonld-${id}`;
    el.text = JSON.stringify(data);
    // Remove any previous instance with the same id.
    document.getElementById(el.id)?.remove();
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [id, JSON.stringify(data)]);
  return null;
}
