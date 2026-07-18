import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListProducts, adminUpsertProduct, adminDeleteProduct } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Upload, ImageOff, Loader2, X, Video, Image as ImageIcon, Link2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { uploadProductImage, uploadProductMedia, resolveProductImageUrl, resolveProductImageUrls, youtubeId, type MediaItem } from "@/lib/product-image";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

const empty = { slug: "", name: "", brand: "", category: "ac", price: 0, installation_fee: 0, description: "", features: [] as string[], published: true, available: true, stock: 0, low_stock_threshold: null as number | null, seer: null, capacity_btu: null, hspf: null, tag: null, image_url: null as string | null, media: [] as MediaItem[] };

function AdminProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const list = useServerFn(adminListProducts), upsert = useServerFn(adminUpsertProduct), del = useServerFn(adminDeleteProduct);

  const reload = async () => {
    const rows = await list();
    setItems(rows);
    const paths = rows.map((r: any) => r.image_url).filter(Boolean) as string[];
    if (paths.length) setThumbs(await resolveProductImageUrls(paths));
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    let alive = true;
    if (!editing?.image_url) { setPreviewUrl(null); return; }
    resolveProductImageUrl(editing.image_url).then((u) => { if (alive) setPreviewUrl(u); });
    return () => { alive = false; };
  }, [editing?.image_url]);

  // resolve previews for gallery items
  useEffect(() => {
    let alive = true;
    const media: MediaItem[] = editing?.media ?? [];
    const paths = media.map((m) => m.url).filter(Boolean);
    if (!paths.length) { setMediaPreview({}); return; }
    resolveProductImageUrls(paths).then((map) => { if (alive) setMediaPreview(map); });
    return () => { alive = false; };
  }, [editing?.media]);

  const save = async () => {
    try {
      const payload = {
        ...editing,
        features: typeof editing.features === "string" ? editing.features.split("\n").filter(Boolean) : editing.features,
        media: Array.isArray(editing.media) ? editing.media : [],
      };
      await upsert({ data: payload });
      toast.success("Saved"); setEditing(null); reload();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => { if (!confirm("Delete?")) return; await del({ data: { id } }); toast.success("Deleted"); reload(); };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (!editing.slug) { toast.error("Set a slug before uploading an image"); e.target.value = ""; return; }
    setUploading(true);
    try {
      const path = await uploadProductImage(file, editing.slug);
      setEditing({ ...editing, image_url: path });
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !editing) return;
    if (!editing.slug) { toast.error("Set a slug before uploading media"); e.target.value = ""; return; }
    setMediaUploading(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const f of files) uploaded.push(await uploadProductMedia(f, editing.slug));
      setEditing({ ...editing, media: [...(editing.media ?? []), ...uploaded] });
      toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} added`);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setMediaUploading(false);
      if (mediaRef.current) mediaRef.current.value = "";
    }
  };

  const addMediaUrl = () => {
    const url = mediaUrlInput.trim();
    if (!url) return;
    const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || youtubeId(url) !== null || /vimeo\.com/.test(url);
    setEditing({ ...editing, media: [...(editing.media ?? []), { url, type: isVideo ? "video" : "image" } as MediaItem] });
    setMediaUrlInput("");
  };

  const updateMedia = (idx: number, next: Partial<MediaItem> | null) => {
    const arr: MediaItem[] = [...(editing.media ?? [])];
    if (next === null) arr.splice(idx, 1);
    else arr[idx] = { ...arr[idx], ...next };
    setEditing({ ...editing, media: arr });
  };
  const moveMedia = (idx: number, dir: -1 | 1) => {
    const arr: MediaItem[] = [...(editing.media ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setEditing({ ...editing, media: arr });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={() => setEditing({ ...empty })} className="gradient-cool text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> New</Button>
      </div>

      {editing && (
        <Card className="mt-4"><CardContent className="p-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[160px,1fr]">
            <div className="space-y-2">
              <Label>Primary image</Label>
              <div className="relative aspect-square w-40 overflow-hidden rounded-lg border border-border bg-muted">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-background/70">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {editing.image_url ? "Replace" : "Upload"}
                </Button>
                {editing.image_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ ...editing, image_url: null })}>Remove</Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Shown in cards. JPG/PNG/WebP, max 5&nbsp;MB.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Brand</Label><Input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
              <div><Label>Price ($)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
              <div><Label>Installation fee ($)</Label><Input type="number" value={editing.installation_fee} onChange={(e) => setEditing({ ...editing, installation_fee: Number(e.target.value) })} /></div>
              <div><Label>Stock on hand</Label><Input type="number" min={0} value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
              <div>
                <Label>Low-stock reminder at</Label>
                <Input type="number" min={0} placeholder="e.g. 3 (leave blank to disable)"
                  value={editing.low_stock_threshold ?? ""}
                  onChange={(e) => setEditing({ ...editing, low_stock_threshold: e.target.value === "" ? null : Number(e.target.value) })} />
                <p className="mt-1 text-[11px] text-muted-foreground">Product appears in the Inbox low-stock reminder when stock reaches this number.</p>
              </div>
              <div><Label>Tag</Label><Input value={editing.tag ?? ""} onChange={(e) => setEditing({ ...editing, tag: e.target.value || null })} /></div>

              <div className="flex items-center gap-2"><Switch checked={editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} /><Label>Published</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editing.available} onCheckedChange={(v) => setEditing({ ...editing, available: v })} /><Label>Available</Label></div>
            </div>
          </div>

          {/* Gallery editor */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Product gallery</Label>
                <p className="text-[11px] text-muted-foreground">Add multiple photos and videos. Drag order with the arrows. YouTube links supported.</p>
              </div>
              <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPickMedia} />
              <Button type="button" variant="outline" size="sm" onClick={() => mediaRef.current?.click()} disabled={mediaUploading}>
                {mediaUploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />} Add files
              </Button>
            </div>

            <div className="mt-3 flex gap-2">
              <Input placeholder="Paste image or YouTube/video URL…" value={mediaUrlInput}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } }} />
              <Button type="button" variant="outline" onClick={addMediaUrl}><Link2 className="mr-1 h-3.5 w-3.5" /> Add URL</Button>
            </div>

            {(editing.media ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No gallery items yet. The primary image will be shown alone.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {(editing.media as MediaItem[]).map((m, i) => {
                  const src = mediaPreview[m.url] ?? m.url;
                  const yt = youtubeId(src);
                  return (
                    <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {m.type === "video" ? (
                          yt ? (
                            <img src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          )
                        ) : (
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        )}
                        <span className="absolute bottom-0 right-0 rounded-tl bg-background/85 px-1 text-[10px]">
                          {m.type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">{m.url}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <select
                            value={m.type}
                            onChange={(e) => updateMedia(i, { type: e.target.value as "image" | "video" })}
                            className="h-7 rounded border border-input bg-background px-2 text-xs"
                          >
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                          </select>
                          {i === 0 && <Badge variant="secondary" className="text-[10px]">Cover</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveMedia(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveMedia(i, 1)} disabled={i === (editing.media.length - 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => updateMedia(i, null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div><Label>Description</Label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div><Label>Features (one per line)</Label><textarea rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={Array.isArray(editing.features) ? editing.features.join("\n") : editing.features}
            onChange={(e) => setEditing({ ...editing, features: e.target.value })} /></div>
          <div className="flex gap-2"><Button onClick={save} className="gradient-cool text-primary-foreground">Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <div className="mt-4 grid gap-2">
        {items.map((p) => (
          <Card key={p.id}><CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {p.image_url && thumbs[p.image_url] ? (
                  <img src={thumbs[p.image_url]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageOff className="h-5 w-5" /></div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{p.brand} — {p.name}</p>
                  {!p.published && <Badge variant="secondary">draft</Badge>}
                  {!p.available && <Badge variant="destructive">unavailable</Badge>}
                  {Array.isArray(p.media) && p.media.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{p.media.length} media</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">${p.price} • Stock: {p.stock}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing({ ...p, media: Array.isArray(p.media) ? p.media : [] })}><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
