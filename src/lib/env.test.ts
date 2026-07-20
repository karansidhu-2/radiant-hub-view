import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Environment-variable contract tests.
 *
 * These verify the `.env` file the app reads at build/runtime contains every
 * variable the codebase requires, and that each value has the expected shape.
 * A misconfigured env is the #1 source of "works locally / breaks in prod"
 * bugs — this suite catches missing or malformed keys before the app boots.
 */

const envPath = path.resolve(process.cwd(), ".env");
const raw = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\r\n]*)"?\s*$/i);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = parseEnv(raw);

// The Supabase publishable/anon key is a JWT: header.payload.signature
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
const REF_RE = /^[a-z0-9]{20}$/;

const REQUIRED_SERVER = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_ID",
] as const;

const REQUIRED_CLIENT = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
] as const;

describe("env: required variables are present", () => {
  it.each([...REQUIRED_SERVER, ...REQUIRED_CLIENT])("%s is defined and non-empty", (name) => {
    expect(env[name], `${name} missing from .env`).toBeTruthy();
  });
});

describe("env: Supabase values have the correct shape", () => {
  it("SUPABASE_URL matches https://<ref>.supabase.co", () => {
    expect(env.SUPABASE_URL).toMatch(URL_RE);
  });
  it("VITE_SUPABASE_URL matches https://<ref>.supabase.co", () => {
    expect(env.VITE_SUPABASE_URL).toMatch(URL_RE);
  });
  it("SUPABASE_PROJECT_ID is a 20-char ref", () => {
    expect(env.SUPABASE_PROJECT_ID).toMatch(REF_RE);
  });
  it("VITE_SUPABASE_PROJECT_ID is a 20-char ref", () => {
    expect(env.VITE_SUPABASE_PROJECT_ID).toMatch(REF_RE);
  });
  it("SUPABASE_PUBLISHABLE_KEY is a JWT-shaped token", () => {
    expect(env.SUPABASE_PUBLISHABLE_KEY).toMatch(JWT_RE);
  });
  it("VITE_SUPABASE_PUBLISHABLE_KEY is a JWT-shaped token", () => {
    expect(env.VITE_SUPABASE_PUBLISHABLE_KEY).toMatch(JWT_RE);
  });
});

describe("env: server and client vars stay in sync", () => {
  it("URLs match between server (SUPABASE_URL) and client (VITE_SUPABASE_URL)", () => {
    expect(env.VITE_SUPABASE_URL).toBe(env.SUPABASE_URL);
  });
  it("project IDs match between server and client", () => {
    expect(env.VITE_SUPABASE_PROJECT_ID).toBe(env.SUPABASE_PROJECT_ID);
  });
  it("publishable keys match between server and client", () => {
    expect(env.VITE_SUPABASE_PUBLISHABLE_KEY).toBe(env.SUPABASE_PUBLISHABLE_KEY);
  });
  it("URL host contains the project ref", () => {
    expect(env.SUPABASE_URL).toContain(env.SUPABASE_PROJECT_ID);
  });
});

describe("env: publishable JWT payload is valid and matches project", () => {
  const payload = JSON.parse(
    Buffer.from(
      (env.SUPABASE_PUBLISHABLE_KEY ?? "").split(".")[1] ?? "",
      "base64",
    ).toString("utf8") || "{}",
  ) as { ref?: string; role?: string; exp?: number; iss?: string };

  it("has role=anon (publishable, not service_role)", () => {
    expect(payload.role).toBe("anon");
  });
  it("issuer is supabase", () => {
    expect(payload.iss).toBe("supabase");
  });
  it("ref in JWT matches SUPABASE_PROJECT_ID", () => {
    expect(payload.ref).toBe(env.SUPABASE_PROJECT_ID);
  });
  it("is not expired", () => {
    expect(payload.exp).toBeTypeOf("number");
    expect(payload.exp! * 1000).toBeGreaterThan(Date.now());
  });
});

describe("env: secrets that must NOT be in .env", () => {
  // Service role key bypasses RLS — it must live in Lovable Cloud secrets,
  // never in the checked-in .env file that ships to the client bundle path.
  it("SUPABASE_SERVICE_ROLE_KEY is not committed to .env", () => {
    expect(raw).not.toMatch(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/m);
  });
  it("no key with role=service_role appears anywhere in .env", () => {
    for (const [, value] of Object.entries(env)) {
      if (!JWT_RE.test(value)) continue;
      try {
        const p = JSON.parse(Buffer.from(value.split(".")[1], "base64").toString("utf8"));
        expect(p.role, `.env contains a service_role JWT`).not.toBe("service_role");
      } catch {
        /* not a JWT payload */
      }
    }
  });
});
