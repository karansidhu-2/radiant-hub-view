import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_IMAGES_BUCKET = "product-images";

export type MediaItem = {
  url: string;                 // storage path OR full https URL (incl. YouTube/Vimeo)
  type: "image" | "video";
  poster?: string | null;      // optional poster path for videos
};

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

/** Upload an image file. Returns the stored object path. */
export async function uploadProductImage(file: File, slug: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_IMAGE) throw new Error("Image must be under 5 MB.");
  return uploadTo(file, slug);
}

/** Upload any image or video file for the product gallery. */
export async function uploadProductMedia(file: File, slug: string): Promise<MediaItem> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new Error("Please choose an image or video file.");
  if (isImage && file.size > MAX_IMAGE) throw new Error("Image must be under 5 MB.");
  if (isVideo && file.size > MAX_VIDEO) throw new Error("Video must be under 50 MB.");
  const path = await uploadTo(file, slug);
  return { url: path, type: isImage ? "image" : "video" };
}

async function uploadTo(file: File, slug: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeSlug = (slug || "product").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${safeSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

/** Detect YouTube ID from any common URL form. Returns null if not YouTube. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** Resolve a stored path (or full URL) to a renderable URL. */
export async function resolveProductImageUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Sign a batch of paths in one call. */
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
