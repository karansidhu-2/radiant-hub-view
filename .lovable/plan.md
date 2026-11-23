# Site-wide reliability and security fixes

## Goals
Protect customer and business data, make checkout and booking outcomes reliable, and restore broken or misleading page states while preserving the existing multi-technician booking model.

## Work
1. **Close confirmed access and privacy gaps:** prevent unverified email claims of admin or guest records; limit customer writes to their own review content; prevent direct order, order-item, and booking writes from changing prices, stock, or completion status; hide review notes and sales totals from public reads; protect queued email/SMS processors; harden customer-facing reference links; neutralize spreadsheet formulas in every CSV export.
2. **Make orders and schedules consistent:** save order, items, stock changes, and any requested installation booking as one all-or-nothing checkout; enforce stock and crew capacity atomically; do not schedule installation when it was declined; calculate availability for the selected service and reject services with no qualified capacity; surface failures instead of reporting success; allow later reschedule/status emails to send.
3. **Repair operational and account flows:** keep historical revenue checkpoints from hiding pending work; make admin removal/revocation reliable; avoid stale inventory overwrites and saving default settings after a failed load; include completed service charges on booking invoices; fix local calendar dates; resolve quote products from the live catalog; handle unconfirmed signup and preserve return destinations.
4. **Repair navigation and loading recovery:** make product/service detail and review-audit pages render at their current URLs; give failed catalog/review/service loads a retry or clear error state; fix customer review pages that can remain stuck loading.
5. **Verify:** add or update focused tests for access, pricing, stock, capacity, and status rules; run the typecheck, test suite, public/admin route smoke checks, database linter, and a post-fix security scan.

## Technical details
Use additive Lovable Cloud migrations and server-side transactions/functions; do not hand-edit generated route files. Preserve guest checkout and the intended multi-technician capacity behavior. Confirm hosted email-verification settings before relying on verification gates.
