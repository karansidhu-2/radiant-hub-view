# Visual Regression Tests

Pixel-diff screenshots for the landing page, customer account, and admin
screens. Baselines live in `__snapshots__/`; diffs on failure land in
`__diffs__/` (git-ignored).

## Run locally

```bash
# 1. Start the dev server in another terminal
bun run dev

# 2. Run the visual suite
node tests/visual/visual-regression.spec.mjs

# Accept intentional UI changes as the new baseline
UPDATE_SNAPSHOTS=1 node tests/visual/visual-regression.spec.mjs
```

Or use the shortcut: `bun run test:visual` (add `--update` env manually).

## Coverage

| Screen              | Viewport   | Auth        |
| ------------------- | ---------- | ----------- |
| `/` landing         | 1280×900   | anonymous   |
| `/` landing         | 390×844    | anonymous   |
| `/account`          | 1280×900   | customer    |
| `/admin`            | 1280×900   | admin       |
| `/admin/settings`   | 1280×900   | admin       |

Auth is mocked via `tests/mocks/supabase.mjs` — no real network calls.

## Thresholds

- Per-pixel color threshold: `0.1`
- Max drifted pixels: `0.5%` of frame

Tune inside `visual-regression.spec.mjs` if antialiasing on a new platform
creates noise.

## Upgrading to Chromatic or Percy

The suite is a drop-in replacement:

- **Chromatic:** install `chromatic` and point its Playwright integration at
  the same URLs and viewports; delete the local `__snapshots__/` and let
  Chromatic host baselines.
- **Percy:** wrap `page.screenshot(...)` calls in `percySnapshot(page, name)`
  and add `PERCY_TOKEN` to CI.

CI hook (`.github/workflows/visual.yml`) already builds and serves the app;
only the runner step changes.
