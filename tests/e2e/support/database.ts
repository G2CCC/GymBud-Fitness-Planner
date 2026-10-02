import type { Page, PlaywrightWorkerArgs } from "@playwright/test";

export const hasDatabase = Boolean(process.env.DATABASE_URL);
export const e2eUserId = process.env.E2E_USER_ID ?? "e2e-demo-user";

export async function createApiContext(
  playwright: PlaywrightWorkerArgs["playwright"],
) {
  return playwright.request.newContext({
    baseURL: "http://localhost:3000/api",
    extraHTTPHeaders: {
      Authorization: `Bearer test-token:${e2eUserId}`,
    },
  });
}

export async function signInE2eUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${e2eUserId}@example.test`);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(calendar|onboarding)$/);
}

export async function resetE2eData(): Promise<void> {
  if (!hasDatabase) {
    return;
  }

  const { db } = await import("../../../server/src/db");
  await db.scheduledWorkout.deleteMany({ where: { userId: e2eUserId } });
  await db.trainingCycle.deleteMany({ where: { userId: e2eUserId } });
  await db.nutritionDay.deleteMany({where:{userId:e2eUserId}});
  await db.nutritionTarget.deleteMany({where:{userId:e2eUserId}});
  await db.userProfile.update({where:{userId:e2eUserId},data:{nutritionStartedOn:null}});
  const {ProfileService}=await import('../../../server/src/profiles/service');
  await new ProfileService(db).saveProfile(e2eUserId,{sex:'MALE',age:27,heightCm:178,weightKg:82,primaryGoal:'FAT_LOSS',weeklyTrainingDays:3,sessionDurationMinutes:60,recordingTimezone:'UTC'},new Date(Date.now()-14*86400000));
}

export async function createExpiredCycleFixture() {
  const { db } = await import("../../../server/src/db");
  const now = new Date();
  const startDate = startOfUtcDay(addDays(now, -7));
  const endDate = addDays(startDate, 6);

  const cycle = await db.trainingCycle.create({
    data: {
      userId: e2eUserId,
      cycleNumber: 1,
      startDate,
      endDate,
      timezone: "UTC",
      status: "ACTIVE",
      workouts: {
        create: [
          {
            userId: e2eUserId,
            activityType: "CARDIO",
            activityOptionId:"cardio-treadmill-running",
            scheduledDate: addDays(now, -3),
            durationMinutes: 30,
            status: "PLANNED",
          },
          {
            userId: e2eUserId,
            activityType: "SPORT",
            activityOptionId:"sport-basketball",
            scheduledDate: addDays(now, -2),
            durationMinutes: 45,
            status: "PLANNED",
          },
        ],
      },
    },
    include: { workouts: true },
  });

  return {
    cycle,
    backfillWorkout: cycle.workouts[0]!,
    unresolvedWorkout: cycle.workouts[1]!,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
