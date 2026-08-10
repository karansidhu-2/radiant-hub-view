/**
 * Curated icon registry.
 *
 * IMPORTANT: never `import * as Icons from "lucide-react"` here — the barrel
 * import pulls the entire icon set (~600 KB raw) into a shared chunk that
 * every route pays for. Named imports are tree-shaken, so only these icons
 * ship. Add new names to ICONS (and they become selectable in the admin UI).
 */
import { type LucideIcon } from "lucide-react";
import Snowflake from "lucide-react/dist/esm/icons/snowflake";
import Flame from "lucide-react/dist/esm/icons/flame";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import Wind from "lucide-react/dist/esm/icons/wind";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import PhoneCall from "lucide-react/dist/esm/icons/phone-call";
import Zap from "lucide-react/dist/esm/icons/zap";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";
import Filter from "lucide-react/dist/esm/icons/filter";
import Calculator from "lucide-react/dist/esm/icons/calculator";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Timer from "lucide-react/dist/esm/icons/timer";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Clock from "lucide-react/dist/esm/icons/clock";
import BadgeCheck from "lucide-react/dist/esm/icons/badge-check";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Fan from "lucide-react/dist/esm/icons/fan";
import Droplets from "lucide-react/dist/esm/icons/droplets";
import Gauge from "lucide-react/dist/esm/icons/gauge";
import Home from "lucide-react/dist/esm/icons/home";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Settings from "lucide-react/dist/esm/icons/settings";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import Truck from "lucide-react/dist/esm/icons/truck";
import Leaf from "lucide-react/dist/esm/icons/leaf";
import Sun from "lucide-react/dist/esm/icons/sun";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import Battery from "lucide-react/dist/esm/icons/battery";
import Plug from "lucide-react/dist/esm/icons/plug";
import Package from "lucide-react/dist/esm/icons/package";
import Star from "lucide-react/dist/esm/icons/star";

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
