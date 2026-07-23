## Storage RLS audit result

Only one storage bucket exists in this project: **`product-images`** (private, `public=false`). No customer, booking, order, review, or profile upload buckets exist — the app has no per-user file upload surface today, so cross-account file leakage is not possible by construction.

### Bucket: `product-images`
- Visibility: private bucket, but served through signed/public-read policy.
- Policies on `storage.objects`:
  - **SELECT** — `anon` + `authenticated`, any object in this bucket. Intentional: product images render on the public shop.
  - **INSERT / UPDATE / DELETE** — `authenticated` AND `has_role(auth.uid(),'admin')`. Only admins can write.
- `has_role` is a `SECURITY DEFINER` function reading `public.user_roles`, which itself is admin-writable only. No privilege-escalation path.

### Verdict
Storage policies are correct for the current feature set:
- No user can read another user's files, because no user-scoped files exist.
- No non-admin can write, replace, or delete product images.
- Public read on `product-images` is intentional (shop imagery) and contains no PII.

### No changes required
The plan here is intentionally a no-op on code and schema. There is nothing to fix.

### Optional hardening (only if you want it — say the word)
1. Path-scoped admin writes: constrain INSERT/UPDATE `with_check` to `name LIKE 'products/%'` so a compromised admin token can't stash arbitrary paths.
2. MIME/size guard trigger on `storage.objects` for the bucket (reject non-image mimetypes, cap size).
3. If you ever add customer uploads (avatars, job-site photos, review attachments), add a new bucket with `(storage.foldername(name))[1] = auth.uid()::text` policies — do NOT reuse `product-images`.

Tell me if you want any of the optional items applied; otherwise this audit stands as "verified, no action needed".
