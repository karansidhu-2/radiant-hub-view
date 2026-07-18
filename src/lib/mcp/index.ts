import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listServices from "./tools/list-services";
import listProducts from "./tools/list-products";
import checkServiceArea from "./tools/check-service-area";
import listMyBookings from "./tools/list-my-bookings";
import listMyOrders from "./tools/list-my-orders";
import bookService from "./tools/book-service";
import getSiteInfo from "./tools/get-site-info";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hvac-pro-mcp",
  title: "HVAC Pro",
  version: "0.1.0",
  instructions:
    "Tools for the HVAC Pro storefront. Browse services and products, check if a ZIP is in the service area, view your own bookings and orders, and book a service appointment. Authenticated tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getSiteInfo,
    listServices,
    listProducts,
    checkServiceArea,
    listMyBookings,
    listMyOrders,
    bookService,
  ],
});
