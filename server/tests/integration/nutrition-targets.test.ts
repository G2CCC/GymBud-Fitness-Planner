import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "../../src/db";
import { ProfileService } from "../../src/profiles/service";
import { getTargetForDate } from "../../src/nutrition/targets";
const profile = {
  sex: "MALE" as const,
  age: 27,
  heightCm: 180,
  weightKg: 80,
  primaryGoal: "FAT_LOSS" as const,
  weeklyTrainingDays: 3,
  sessionDurationMinutes: 60,
  recordingTimezone: "Pacific/Auckland",
};
describe.skipIf(!process.env.DATABASE_URL)(
  "nutrition target persistence",
  () => {
    const id = randomUUID();
    const service = new ProfileService(db);
    afterAll(async () => {
      await db.user.deleteMany({ where: { id } });
      await db.$disconnect();
    });
    it("atomically creates targets, preserves past dates, and ignores training-only edits", async () => {
      await db.user.create({ data: { id, email: `${id}@test.example` } });
      await service.saveProfile(id, profile, new Date("2026-10-01T00:00:00Z"));
      expect((await getTargetForDate(db, id, "2026-10-01"))?.kcal).toBe(1939);
      expect(await getTargetForDate(db, id, "2026-09-30")).toBeNull();
      await service.saveProfile(
        id,
        { ...profile, weightKg: 81 },
        new Date("2026-10-02T00:00:00Z"),
      );
      await service.saveProfile(
        id,
        { ...profile, weightKg: 82 },
        new Date("2026-10-02T01:00:00Z"),
      );
      expect((await getTargetForDate(db, id, "2026-10-01"))?.kcal).toBe(1939);
      expect((await getTargetForDate(db, id, "2026-10-02"))?.kcal).toBe(1960);
      await service.saveProfile(
        id,
        { ...profile, weightKg: 82, weeklyTrainingDays: 5 },
        new Date("2026-10-03T00:00:00Z"),
      );
      expect(await db.nutritionTarget.count({ where: { userId: id } })).toBe(2);
      const before = await db.userProfile.findUnique({ where: { userId: id } });
      await expect(
        service.saveProfile(id, {
          ...profile,
          age: 100,
          heightCm: 50,
          weightKg: 20,
        }),
      ).rejects.toThrow();
      expect(
        await db.userProfile.findUnique({ where: { userId: id } }),
      ).toEqual(before);
    });
    it("does not overwrite a past target when crossing the date line", async () => {
      await service.saveProfile(
        id,
        { ...profile, weightKg: 83, recordingTimezone: "Pacific/Honolulu" },
        new Date("2026-10-02T01:00:00Z"),
      );
      expect((await getTargetForDate(db, id, "2026-10-01"))?.kcal).toBe(1939);
      expect((await getTargetForDate(db, id, "2026-10-02"))?.kcal).toBe(1971);
    });
    it("protects a past pinned day even when the last target version is much older", async () => {
      const traveler = randomUUID();
      try {
        await db.user.create({
          data: { id: traveler, email: `${traveler}@travel.test` },
        });
        await service.saveProfile(
          traveler,
          profile,
          new Date("2026-10-01T00:00:00Z"),
        );
        await db.nutritionDay.create({
          data: {
            userId: traveler,
            localDate: "2026-10-09",
            timezone: "Pacific/Auckland",
            completedAt: new Date("2026-10-09T01:00:00Z"),
          },
        });
        const at = new Date("2026-10-09T22:00:00Z");
        await service.saveProfile(
          traveler,
          { ...profile, recordingTimezone: "Pacific/Honolulu" },
          at,
        );
        await service.saveProfile(
          traveler,
          { ...profile, weightKg: 81, recordingTimezone: "Pacific/Honolulu" },
          at,
        );
        expect((await getTargetForDate(db, traveler, "2026-10-09"))?.kcal).toBe(
          1939,
        );
        expect((await getTargetForDate(db, traveler, "2026-10-10"))?.kcal).toBe(
          1949,
        );
      } finally {
        await db.user.deleteMany({ where: { id: traveler } });
      }
    });
  },
);
