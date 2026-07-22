import { Badge } from "@/components/ui/badge";
import { FileText, MailCheck, MailX } from "lucide-react";

export type InvoiceInfo = { generated?: boolean; sent?: boolean } | null | undefined;

export function InvoiceBadge({ invoice, className }: { invoice: InvoiceInfo; className?: string }) {
  const generated = !!invoice?.generated;
  const sent = !!invoice?.sent;

  if (sent) {
    return (
      <Badge variant="default" className={className} title="Invoice email delivered to customer">
        <MailCheck className="mr-1 h-3 w-3" /> Invoice sent
      </Badge>
    );
  }
  if (generated) {
    return (
      <Badge variant="secondary" className={className} title="Invoice generated, delivery pending">
        <FileText className="mr-1 h-3 w-3" /> Invoice generated
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={className} title="No invoice generated yet">
      <MailX className="mr-1 h-3 w-3" /> No invoice yet
    </Badge>
  );
}
