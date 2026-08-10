/**
 * Curated icon registry.
 *
 * IMPORTANT: never `import * as Icons from "lucide-react"` here — the barrel
 * import pulls the entire icon set (~600 KB raw) into a shared chunk that
 * every route pays for. Named imports are tree-shaken, so only these icons
 * ship. Add new names to ICONS (and they become selectable in the admin UI).
 */
import {
  Snowflake,
  Flame,
  Wrench,
  Wind,
  ShieldCheck,
  Sparkles,
  PhoneCall,
  Zap,
  Thermometer,
  Filter,
  Calculator,
  CheckCircle2,
  Timer,
  Wallet,
  Clock,
  BadgeCheck,
  DollarSign,
  Fan,
  Droplets,
  Gauge,
  Home,
  Building2,
  Settings,
  Hammer,
  Truck,
  Leaf,
  Sun,
  Cloud,
  Battery,
  Plug,
  Package,
  Star,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  Snowflake,
  Flame,
  Wrench,
  Wind,
  ShieldCheck,
  Sparkles,
  PhoneCall,
  Zap,
  Thermometer,
  Filter,
  Calculator,
  CheckCircle2,
  Timer,
  Wallet,
  Clock,
  BadgeCheck,
  DollarSign,
  Fan,
  Droplets,
  Gauge,
  Home,
  Building2,
  Settings,
  Hammer,
  Truck,
  Leaf,
  Sun,
  Cloud,
  Battery,
  Plug,
  Package,
  Star,
};

export const ICON_NAMES = Object.keys(ICONS).sort();

export function DynamicIcon({
  name,
  className,
  ...rest
}: { name: string; className?: string } & Record<string, unknown>) {
  const Ico = ICONS[name] ?? Wrench;
  return <Ico className={className} {...rest} />;
}
