#!/usr/bin/env bash
# One-command health check: TypeScript + Vitest + Supabase linter proxy.
# Usage: bun run health   (or)   bash scripts/health-check.sh

set -u
cd "$(dirname "$0")/.."

BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
LOG_DIR=".health-logs"
mkdir -p "$LOG_DIR"

pass=0; fail=0; skip=0
declare -a SUMMARY

run() {
  local name="$1" logfile="$2"; shift 2
  printf "%s▶ %s%s\n" "$BOLD" "$name" "$RESET"
  local start=$SECONDS
  if "$@" >"$logfile" 2>&1; then
    local dur=$((SECONDS-start))
    printf "  %s✓ PASS%s  %ss  %s(%s)%s\n" "$GREEN" "$RESET" "$dur" "$DIM" "$logfile" "$RESET"
    SUMMARY+=("${GREEN}✓${RESET} ${name} (${dur}s)")
    pass=$((pass+1))
  else
    local dur=$((SECONDS-start))
    printf "  %s✗ FAIL%s  %ss  %s(%s)%s\n" "$RED" "$RESET" "$dur" "$DIM" "$logfile" "$RESET"
    tail -n 15 "$logfile" | sed 's/^/    /'
    SUMMARY+=("${RED}✗${RESET} ${name} (${dur}s) — see ${logfile}")
    fail=$((fail+1))
  fi
  echo
}

skip_check() {
  local name="$1" reason="$2"
  printf "%s▶ %s%s\n  %s⚠ SKIP%s  %s\n\n" "$BOLD" "$name" "$RESET" "$YELLOW" "$RESET" "$reason"
  SUMMARY+=("${YELLOW}⚠${RESET} ${name} — skipped: ${reason}")
  skip=$((skip+1))
}

# 1. TypeScript
run "TypeScript (tsgo --noEmit)" "$LOG_DIR/typescript.log" \
  bunx tsgo --noEmit

# 2. Vitest
run "Vitest suite" "$LOG_DIR/vitest.log" \
  bunx vitest run --reporter=dot

# 3. Supabase linter proxy — flags public tables missing RLS.
if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  run "Supabase linter (RLS coverage)" "$LOG_DIR/supabase-linter.log" \
    bash -c '
      out=$(psql "$SUPABASE_DB_URL" -Atc "
        select table_name from information_schema.tables t
        where table_schema=''public'' and table_type=''BASE TABLE''
          and not exists (
            select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname=''public'' and c.relname=t.table_name and c.relrowsecurity
          );")
      if [ -n "$out" ]; then
        echo "Public tables WITHOUT RLS enabled:"; echo "$out"; exit 1
      fi
      echo "All public tables have RLS enabled."
    '
else
  skip_check "Supabase linter (RLS coverage)" "SUPABASE_DB_URL or psql unavailable"
fi

# Summary
echo "${BOLD}── Health check summary ──${RESET}"
for line in "${SUMMARY[@]}"; do printf "  %b\n" "$line"; done
echo
printf "%s%d passed%s · %s%d failed%s · %s%d skipped%s\n" \
  "$GREEN" "$pass" "$RESET" "$RED" "$fail" "$RESET" "$YELLOW" "$skip" "$RESET"

[ "$fail" -eq 0 ]
