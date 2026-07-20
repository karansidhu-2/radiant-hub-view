## 1. Push your code to GitHub

I can't create the GitHub repo from here — do this once in the Lovable UI:

1. Chat input **Plus (+) → GitHub → Connect to GitHub**.
2. Authorize the Lovable GitHub App on your account/org.
3. Click **Create Repository**. Lovable pushes the current code and keeps it in two-way sync from then on.
4. `git clone` the new repo locally to get the files.

## 2. CI workflow: `bun run test` on every PR

Add one new file, no other changes.

**`.github/workflows/test.yml`**
```yaml
name: test
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run test
```

- Runs on every PR and on pushes to `main`.
- Any vitest failure exits non-zero → the check fails → PR is blocked once you enable branch protection on `main` and mark `test` as required (GitHub → Settings → Branches).
- Postgres-backed tests in `src/lib/hvac-guards.test.ts` are already gated by `describe.skipIf(!hasPg)`, so they cleanly skip in CI (no DB there). Zod schema tests and `src/lib/lightbox-swipe.test.ts` still run and catch regressions.

Approve to switch to build mode and I'll add the file.
