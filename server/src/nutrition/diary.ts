import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  calculateFoodPortion,
  completionInputSchema,
  foodEntryInputSchema,
  foodEntryPatchSchema,
  NutritionError,
  type EntryInput,
  type EntryPatch,
  type FoodSnapshot,
} from "@fitness/shared";
import { foodDto, foodEntryDto } from "./serializers";
import { ensureNutritionDay, nutritionDateContext } from "./context";

const conflict = () =>
  new NutritionError(
    "This day changed. Refresh and retry your edit.",
    "REVISION_CONFLICT",
    409,
  );
type Tx = Prisma.TransactionClient;
export class NutritionDiary {
  constructor(
    private readonly db: PrismaClient,
    private readonly now = () => new Date(),
  ) {}

  private async transaction<T>(
    work: (tx: Tx) => Promise<T>,
    retryAdd = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.db.$transaction(work);
      } catch (error) {
        // An identical add may have won after our token lookup but before CAS.
        // Roll back, then recheck its token; a genuinely stale edit still fails.
        if (
          retryAdd &&
          attempt === 0 &&
          error instanceof NutritionError &&
          error.code === "REVISION_CONFLICT"
        )
          continue;
        // A racing first-day insert or request token is classified again after rollback.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2002", "P2034"].includes(error.code)
        ) {
          if (attempt < 2) continue;
          throw conflict();
        }
        throw error;
      }
  }
  private async claim(
    tx: Tx,
    dayId: string,
    revision: number,
    completedAt: Date | null = null,
  ) {
    const updated = await tx.nutritionDay.updateMany({
      where: { id: dayId, revision },
      data: { revision: { increment: 1 }, completedAt },
    });
    if (updated.count !== 1) throw conflict();
    return revision + 1;
  }
  private async catalogSnapshot(
    tx: Tx,
    foodId: string,
    portionId: string | undefined,
    unit: "g" | "ea",
  ) {
    const food = await tx.food.findFirst({
      where: { id: foodId, active: true },
      include: { portions: true },
    });
    if (!food) throw new NutritionError("This food is no longer available");
    const dto = foodDto(food),
      portion = portionId
        ? dto.portions.find((p) => p.id === portionId)
        : undefined;
    if ((portionId && !portion) || (unit === "ea" && !portion))
      throw new NutritionError(
        "Choose a verified portion belonging to this food",
      );
    return {
      foodId,
      portionId: portion?.id ?? null,
      snapshot: {
        name: dto.name,
        per100g: dto.per100g,
        unitGrams: portion?.unitGrams ?? null,
      } satisfies FoodSnapshot,
    };
  }
  private values(snapshot: FoodSnapshot, unit: "g" | "ea", quantity: number) {
    const { grams, totals } = calculateFoodPortion(snapshot, unit, quantity);
    return {
      quantity,
      unit,
      grams,
      nameSnapshot: snapshot.name,
      per100gSnapshot: snapshot.per100g,
      unitGramsSnapshot: snapshot.unitGrams,
      ...totals,
    };
  }
  async add(userId: string, input: EntryInput) {
    const parsed = foodEntryInputSchema.parse(input);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          parsed.date,
          parsed.mealType,
          parsed.foodId,
          parsed.portionId ?? null,
          parsed.unit,
          parsed.quantity,
        ]),
      )
      .digest("hex");
    return this.transaction(async (tx) => {
      const existing = await tx.foodLog.findUnique({
        where: {
          userId_clientRequestId: {
            userId,
            clientRequestId: parsed.clientRequestId,
          },
        },
        include: { day: true },
      });
      if (existing) {
        if (existing.deletedAt || existing.requestFingerprint !== fingerprint)
          throw new NutritionError(
            "This request ID was already used for a different or deleted entry",
            "REQUEST_CONFLICT",
            409,
          );
        return {
          entry: foodEntryDto(existing),
          revision: existing.day.revision,
        };
      }
      const context = await nutritionDateContext(
        tx,
        userId,
        parsed.date,
        this.now(),
      );
      const selected = await this.catalogSnapshot(
        tx,
        parsed.foodId,
        parsed.portionId,
        parsed.unit,
      );
      const day =
        context.day ??
        (await ensureNutritionDay(tx, userId, parsed.date, context.timezone));
      const revision = await this.claim(tx, day.id, parsed.expectedRevision);
      const row = await tx.foodLog.create({
        data: {
          userId,
          dayId: day.id,
          mealType: parsed.mealType,
          foodId: selected.foodId,
          portionId: selected.portionId,
          ...this.values(selected.snapshot, parsed.unit, parsed.quantity),
          clientRequestId: parsed.clientRequestId,
          requestFingerprint: fingerprint,
        },
      });
      return { entry: foodEntryDto(row), revision };
    }, true);
  }
  async update(userId: string, id: string, input: EntryPatch) {
    const parsed = foodEntryPatchSchema.parse(input);
    return this.transaction(async (tx) => {
      const existing = await tx.foodLog.findFirst({
        where: { id, userId, deletedAt: null },
        include: { day: true },
      });
      if (!existing)
        throw new NutritionError("Food entry not found", "NOT_FOUND", 404);
      await nutritionDateContext(
        tx,
        userId,
        existing.day.localDate,
        this.now(),
      );
      const selected =
        parsed.foodId !== undefined || parsed.portionId !== undefined
          ? await this.catalogSnapshot(
              tx,
              parsed.foodId ?? existing.foodId,
              parsed.portionId,
              parsed.unit,
            )
          : {
              foodId: existing.foodId,
              portionId: existing.portionId,
              snapshot: foodEntryDto(existing).snapshot,
            };
      const revision = await this.claim(
        tx,
        existing.dayId,
        parsed.expectedRevision,
      );
      const row = await tx.foodLog.update({
        where: { id },
        data: {
          mealType: parsed.mealType,
          foodId: selected.foodId,
          portionId: selected.portionId,
          ...this.values(selected.snapshot, parsed.unit, parsed.quantity),
        },
      });
      return { entry: foodEntryDto(row), revision };
    });
  }
  async remove(userId: string, id: string, expectedRevision: number) {
    z.number().int().nonnegative().parse(expectedRevision);
    return this.transaction(async (tx) => {
      const existing = await tx.foodLog.findFirst({
        where: { id, userId, deletedAt: null },
        include: { day: true },
      });
      if (!existing)
        throw new NutritionError("Food entry not found", "NOT_FOUND", 404);
      await nutritionDateContext(
        tx,
        userId,
        existing.day.localDate,
        this.now(),
      );
      const revision = await this.claim(tx, existing.dayId, expectedRevision);
      await tx.foodLog.update({
        where: { id },
        data: { deletedAt: this.now() },
      });
      return { revision };
    });
  }
  async setCompletion(
    userId: string,
    date: string,
    input: { complete: boolean; expectedRevision: number },
  ) {
    const parsed = completionInputSchema.parse(input);
    return this.transaction(async (tx) => {
      const context = await nutritionDateContext(tx, userId, date, this.now());
      const day =
        context.day ??
        (await ensureNutritionDay(tx, userId, date, context.timezone));
      const completedAt = parsed.complete ? this.now() : null;
      const revision = await this.claim(
        tx,
        day.id,
        parsed.expectedRevision,
        completedAt,
      );
      return { revision, completedAt: completedAt?.toISOString() ?? null };
    });
  }
}
