import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Upload a File to product-images and return the stored object path. */
export async function uploadProductImage(file: File, slug: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeSlug = (slug || "product").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${safeSlug}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

/** Resolve a stored path (or full URL) into something an <img> can render. */
export async function resolveProductImageUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 60 * 24 * 7); // 7 days
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Sign a batch of paths in one call (returns a map keyed by input path). */
export async function resolveProductImageUrls(paths: string[]): Promise<Record<string, string>> {
  const relative = paths.filter((p) => p && !/^https?:\/\//i.test(p));
  const map: Record<string, string> = {};
  for (const p of paths) if (p && /^https?:\/\//i.test(p)) map[p] = p;
  if (relative.length === 0) return map;
  const { data } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrls(relative, 60 * 60 * 24 * 7);
  for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
  return map;
}
