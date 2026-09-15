import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/db";
import { seedTestUser } from "../../src/current-user";

describe.skipIf(!process.env.DATABASE_URL)("test user persistence", () => {
  it("seeds a user with a profile and no cycles", async () => {
    const result = await seedTestUser("seed-test-user");
    const user = await db.user.findUnique({
      where: { id: result.userId },
      include: { profile: true, cycles: true },
    });

    expect(user?.profile?.defaultLocation).toBe("GYM");
    expect(user?.authUserId).toBe("test:seed-test-user");
    expect(user?.profile).toMatchObject({
      gender: "MALE",
      age: 27,
      heightCm: 178,
      weightKg: 82,
    });
    expect(user?.cycles).toHaveLength(0);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
