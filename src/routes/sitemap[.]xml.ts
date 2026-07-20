import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://radiant-hub-view.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/shop", changefreq: "daily", priority: "0.9" },
          { path: "/services", changefreq: "weekly", priority: "0.9" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/book", changefreq: "monthly", priority: "0.7" },
        ];

        // Fetch published services and products from Supabase Data API.
        try {
          const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const headers = { apikey: key, Authorization: `Bearer ${key}` } as Record<string, string>;
            const [servicesRes, productsRes] = await Promise.all([
              fetch(`${url}/rest/v1/services?select=slug,updated_at&published=eq.true`, { headers }),
              fetch(`${url}/rest/v1/products?select=slug,updated_at&published=eq.true`, { headers }),
            ]);
            if (servicesRes.ok) {
              const rows = (await servicesRes.json()) as Array<{ slug: string; updated_at?: string }>;
              for (const r of rows) {
                entries.push({
                  path: `/services/${r.slug}`,
                  lastmod: r.updated_at?.slice(0, 10),
                  changefreq: "monthly",
                  priority: "0.8",
                });
              }
            }
            if (productsRes.ok) {
              const rows = (await productsRes.json()) as Array<{ slug: string; updated_at?: string }>;
              for (const r of rows) {
                entries.push({
                  path: `/shop/${r.slug}`,
                  lastmod: r.updated_at?.slice(0, 10),
                  changefreq: "weekly",
                  priority: "0.8",
                });
              }
            }
          }
        } catch (err) {
          console.error("[sitemap] failed to fetch dynamic rows", err);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
