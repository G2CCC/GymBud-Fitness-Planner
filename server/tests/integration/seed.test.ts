import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { seedDemoUser } from "../../src/current-user";

describe.skipIf(!process.env.DATABASE_URL)("demo user persistence", () => {
  it("seeds a user with a profile and no cycles", async () => {
    const result = await seedDemoUser();
    const user = await db.user.findUnique({
      where: { id: result.userId },
      include: { profile: true, cycles: true },
    });

    expect(user?.profile?.defaultLocation).toBe("GYM");
    expect(user?.cycles).toHaveLength(0);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
