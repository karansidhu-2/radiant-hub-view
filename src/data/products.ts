export type ProductCategory = "ac" | "furnace" | "heat-pump" | "mini-split" | "thermostat" | "filter" | "iaq";

export interface Product {
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  installationFee: number;
  seer?: number;
  capacityBTU?: number;
  hspf?: number;
  description: string;
  features: string[];
  tag?: string;
}

export const productCategories: { id: ProductCategory; label: string }[] = [
  { id: "ac", label: "Central AC" },
  { id: "furnace", label: "Furnaces" },
  { id: "heat-pump", label: "Heat Pumps" },
  { id: "mini-split", label: "Mini-Splits" },
  { id: "thermostat", label: "Thermostats" },
  { id: "filter", label: "Filters" },
  { id: "iaq", label: "Air Quality" },
];

export const products: Product[] = [
  {
    slug: "carrier-infinity-24-ac",
    name: "Infinity 24 Central AC",
    brand: "Carrier",
    category: "ac",
    price: 4899,
    installationFee: 1499,
    seer: 24,
    capacityBTU: 36000,
    description: "Variable-speed 3-ton central AC with Greenspeed intelligence. Whisper-quiet at 51 dB.",
    features: ["24 SEER2 efficiency", "Variable-speed inverter", "10-year parts warranty", "Wi-Fi enabled"],
    tag: "Best seller",
  },
  {
    slug: "trane-xr16-ac",
    name: "XR16 Central AC",
    brand: "Trane",
    category: "ac",
    price: 3299,
    installationFee: 1399,
    seer: 17,
    capacityBTU: 30000,
    description: "Reliable single-stage central AC with Climatuff compressor and Spine Fin coil.",
    features: ["17 SEER2 efficiency", "Durable spine-fin coil", "10-year compressor warranty", "Great value pick"],
  },
  {
    slug: "lennox-el296v-furnace",
    name: "EL296V Gas Furnace",
    brand: "Lennox",
    category: "furnace",
    price: 3199,
    installationFee: 1299,
    description: "96% AFUE two-stage gas furnace with variable-speed blower for even temperatures.",
    features: ["96% AFUE efficiency", "Two-stage heating", "Variable-speed blower", "20-year heat exchanger"],
  },
  {
    slug: "goodman-gmes96-furnace",
    name: "GMES96 Gas Furnace",
    brand: "Goodman",
    category: "furnace",
    price: 2199,
    installationFee: 1199,
    description: "96% AFUE single-stage gas furnace — dependable heat at a great price.",
    features: ["96% AFUE efficiency", "Multi-position install", "Lifetime heat exchanger", "10-year parts warranty"],
    tag: "Value",
  },
  {
    slug: "mitsubishi-hyperheat-heat-pump",
    name: "Hyper-Heat H2i Heat Pump",
    brand: "Mitsubishi",
    category: "heat-pump",
    price: 5899,
    installationFee: 1599,
    seer: 22,
    hspf: 10.5,
    capacityBTU: 36000,
    description: "Cold-climate heat pump delivering 100% heating capacity down to 5°F.",
    features: ["Full heat to 5°F", "22 SEER2 cooling", "IRA tax credit eligible", "12-year compressor warranty"],
    tag: "IRA eligible",
  },
  {
    slug: "bosch-ids-2-heat-pump",
    name: "IDS 2.0 Inverter Heat Pump",
    brand: "Bosch",
    category: "heat-pump",
    price: 4599,
    installationFee: 1499,
    seer: 20.5,
    hspf: 10,
    capacityBTU: 30000,
    description: "Inverter-driven heat pump with ultra-quiet operation and precise temperature control.",
    features: ["Inverter technology", "56 dB quiet operation", "Wi-Fi ready", "10-year warranty"],
  },
  {
    slug: "daikin-fit-mini-split",
    name: "Fit Ductless Mini-Split",
    brand: "Daikin",
    category: "mini-split",
    price: 1899,
    installationFee: 899,
    seer: 20,
    capacityBTU: 12000,
    description: "12,000 BTU single-zone ductless heat pump. Perfect for additions, sunrooms, and garages.",
    features: ["Single-zone", "Heat + cool", "Wi-Fi remote", "Low-ambient heat"],
  },
  {
    slug: "ecobee-premium-thermostat",
    name: "Smart Thermostat Premium",
    brand: "Ecobee",
    category: "thermostat",
    price: 249,
    installationFee: 149,
    description: "Smart thermostat with built-in air quality monitor, occupancy sensing, and voice control.",
    features: ["Air quality monitor", "Smart sensor included", "Alexa & Siri built in", "Energy Star certified"],
    tag: "Smart",
  },
  {
    slug: "nest-learning-thermostat",
    name: "Learning Thermostat (4th Gen)",
    brand: "Google Nest",
    category: "thermostat",
    price: 279,
    installationFee: 149,
    description: "Learns your schedule and auto-adjusts to save an average 10-12% on heating bills.",
    features: ["Auto-schedule", "Farsight display", "Energy history", "Works with Google Home"],
  },
  {
    slug: "aprilaire-413-filter",
    name: "413 MERV-13 Media Filter",
    brand: "Aprilaire",
    category: "filter",
    price: 89,
    installationFee: 49,
    description: "Whole-home MERV-13 media filter — captures 98% of airborne particles including virus carriers.",
    features: ["MERV-13 rated", "Fits 4-inch cabinets", "1-year lifespan", "Reduces allergens"],
  },
  {
    slug: "reme-halo-uv",
    name: "REME HALO Whole-Home UV Purifier",
    brand: "RGF",
    category: "iaq",
    price: 749,
    installationFee: 249,
    description: "In-duct UV air purifier that neutralizes bacteria, viruses, mold, and VOCs at the source.",
    features: ["Kills 99% pathogens", "Reduces odors", "Ionized hydro-peroxides", "2-year bulb life"],
  },
  {
    slug: "aprilaire-700-humidifier",
    name: "700 Whole-Home Humidifier",
    brand: "Aprilaire",
    category: "iaq",
    price: 379,
    installationFee: 299,
    description: "Fan-powered whole-home humidifier delivering up to 18 gallons per day of comfort.",
    features: ["Up to 4,200 sq ft", "Digital humidistat", "Automatic operation", "5-year warranty"],
  },
];

export const productBySlug = (slug: string) => products.find((p) => p.slug === slug);
export const formatMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
