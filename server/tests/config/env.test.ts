import "dotenv/config";
import { afterEach, describe, expect, it } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_URL;

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
