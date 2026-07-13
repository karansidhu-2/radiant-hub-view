export type ServiceCategory = "cooling" | "heating" | "install" | "air-quality" | "maintenance" | "emergency";

export interface Service {
  slug: string;
  name: string;
  category: ServiceCategory;
  short: string;
  description: string;
  startingAt: number;
  icon: string; // lucide icon name
  bullets: string[];
}

export const services: Service[] = [
  {
    slug: "ac-repair",
    name: "AC Repair & Diagnostics",
    category: "cooling",
    short: "Same-day repair for central AC, heat pumps, and mini-splits.",
    description:
      "Our NATE-certified technicians diagnose and repair every major brand of air conditioner. We arrive fully stocked so most repairs are completed in a single visit.",
    startingAt: 89,
    icon: "Snowflake",
    bullets: ["Free diagnostic with repair", "All parts warrantied 12 months", "Refrigerant recharge & leak sealing", "Compressor & capacitor replacement"],
  },
  {
    slug: "furnace-repair",
    name: "Furnace & Heater Repair",
    category: "heating",
    short: "Fast repair for gas, electric, and oil furnaces before the cold hits.",
    description:
      "From ignitor failures to blower motors, we service every furnace type. Emergency heat calls answered 24/7 during winter months.",
    startingAt: 89,
    icon: "Flame",
    bullets: ["Gas leak & CO safety check", "Ignitor, flame sensor, thermocouple", "Blower motor & control board", "24/7 emergency heat restoration"],
  },
  {
    slug: "new-system-install",
    name: "New System Installation",
    category: "install",
    short: "Full replacement AC, furnaces, and heat pumps with 10-year warranty.",
    description:
      "We size, permit, and install high-efficiency systems from Carrier, Trane, Lennox, and more. Financing available with 0% APR for qualified buyers.",
    startingAt: 3499,
    icon: "Wrench",
    bullets: ["Manual J load calculation", "Permits & inspection included", "10-year parts + 2-year labor", "Old system haul-away"],
  },
  {
    slug: "duct-cleaning",
    name: "Duct Cleaning & Sealing",
    category: "air-quality",
    short: "NADCA-standard cleaning and Aeroseal duct sealing.",
    description:
      "Remove dust, allergens, and mold from your ductwork. Aeroseal sealing can cut duct leakage by up to 90%, lowering utility bills.",
    startingAt: 349,
    icon: "Wind",
    bullets: ["Full negative-pressure vacuum", "Sanitization treatment", "Aeroseal leak sealing", "Before/after airflow report"],
  },
  {
    slug: "maintenance-plan",
    name: "Comfort Maintenance Plan",
    category: "maintenance",
    short: "Twice-a-year tune-ups, priority service, and 15% off repairs.",
    description:
      "Our annual plan includes a spring AC tune-up and a fall furnace tune-up, plus priority scheduling and discounted repairs — for members only.",
    startingAt: 189,
    icon: "ShieldCheck",
    bullets: ["2 tune-ups per year", "Priority 24/7 scheduling", "15% off all repairs", "No overtime charges"],
  },
  {
    slug: "indoor-air-quality",
    name: "Indoor Air Quality",
    category: "air-quality",
    short: "Whole-home air purifiers, humidifiers, UV systems, and filtration.",
    description:
      "Breathe easier with MERV-16 filtration, HEPA bypass units, UV-C germicidal lamps, and whole-home humidifiers installed into your existing HVAC.",
    startingAt: 499,
    icon: "Sparkles",
    bullets: ["MERV-16 media filters", "UV-C germicidal lamps", "Whole-home humidifiers", "Radon & CO monitoring"],
  },
  {
    slug: "emergency-service",
    name: "24/7 Emergency Service",
    category: "emergency",
    short: "No heat? No cool? Certified techs on call around the clock.",
    description:
      "Real people answer the phone at 2 AM. Emergency dispatch across every service area, seven days a week — no holiday surcharges for maintenance-plan members.",
    startingAt: 149,
    icon: "PhoneCall",
    bullets: ["1-hour response window", "Nights, weekends, holidays", "Fully stocked trucks", "Upfront pricing before work begins"],
  },
  {
    slug: "heat-pump-install",
    name: "Heat Pump Installation",
    category: "install",
    short: "High-efficiency heat pumps eligible for federal tax credits.",
    description:
      "Cut your energy bills with ENERGY STAR heat pumps that both heat and cool. Many models qualify for the $2,000 federal Inflation Reduction Act tax credit.",
    startingAt: 4999,
    icon: "Zap",
    bullets: ["Up to 22 SEER2 / 10 HSPF2", "Cold-climate models available", "IRA tax credit assistance", "Utility rebate paperwork included"],
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);
