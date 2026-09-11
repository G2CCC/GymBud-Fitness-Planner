import { describe, expect, it } from "vitest";
import { prismaTransactionOptions } from "../../src/db";

describe("Prisma transaction configuration", () => {
  it("allows remote Supabase transactions to complete beyond Prisma's 5-second default", () => {
    expect(prismaTransactionOptions).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });
});
