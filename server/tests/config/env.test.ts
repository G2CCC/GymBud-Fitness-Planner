import "dotenv/config";
import { afterEach, describe, expect, it } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_URL;
const originalAuthProvider = process.env.AUTH_PROVIDER;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const originalCorsOrigins = process.env.CORS_ORIGINS;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  if (originalDirectUrl === undefined) {
    delete process.env.DIRECT_URL;
  } else {
    process.env.DIRECT_URL = originalDirectUrl;
  }

  if (originalAuthProvider === undefined) {
    delete process.env.AUTH_PROVIDER;
  } else {
    process.env.AUTH_PROVIDER = originalAuthProvider;
  }

  if (originalSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = originalSupabaseUrl;
  }

  if (originalSupabaseAnonKey === undefined) {
    delete process.env.SUPABASE_ANON_KEY;
  } else {
    process.env.SUPABASE_ANON_KEY = originalSupabaseAnonKey;
  }

  if (originalCorsOrigins === undefined) {
    delete process.env.CORS_ORIGINS;
  } else {
    process.env.CORS_ORIGINS = originalCorsOrigins;
  }
});

describe("database environment", () => {
  it("keeps a separate direct URL for Prisma migrations", async () => {
    process.env.DATABASE_URL = "postgresql://runtime.example/postgres";
    process.env.DIRECT_URL = "postgresql://direct.example/postgres";

    const { env } = await import("../../src/config/env");

    expect(env.databaseUrl).toBe("postgresql://runtime.example/postgres");
    expect(env.directUrl).toBe("postgresql://direct.example/postgres");
  });
});

describe("application environment", () => {
  it("parses Supabase auth configuration and comma-separated CORS origins", async () => {
    const { loadEnv } = await import("../../src/config/env");
    const result = loadEnv({
      NODE_ENV: "development",
      AUTH_PROVIDER: "supabase",
      SUPABASE_URL: "https://gymbud.supabase.co",
      SUPABASE_ANON_KEY: "public-key",
      CORS_ORIGINS: "http://localhost:5173, https://gymbud.example.com",
    });

    expect(result.authProvider).toBe("supabase");
    expect(result.supabaseUrl).toBe("https://gymbud.supabase.co");
    expect(result.corsOrigins).toEqual([
      "http://localhost:5173",
      "https://gymbud.example.com",
    ]);
  });

  it("rejects fake auth in production", async () => {
    const { loadEnv } = await import("../../src/config/env");

    expect(() =>
      loadEnv({ NODE_ENV: "production", AUTH_PROVIDER: "fake" }),
    ).toThrow(/fake.*production/i);
  });
});
