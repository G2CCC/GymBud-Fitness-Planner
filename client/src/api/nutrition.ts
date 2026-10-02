import type {
  EntryInput,
  EntryPatch,
  FoodDto,
  FoodEntry,
  NutritionDayDto,
} from "@fitness/shared";
import { request } from "./client";
const json = (method: string, value: unknown) => ({
  method,
  body: JSON.stringify(value),
});
export const getNutritionDay = (date: string) =>
  request<NutritionDayDto>("/nutrition/day?date=" + encodeURIComponent(date));
export const searchFoods = (q: string, cursor?: string) =>
  request<{ items: FoodDto[]; nextCursor: string | null }>(
    "/foods?" + new URLSearchParams({ q, ...(cursor ? { cursor } : {}) }),
  );
export const getFood = (id: string) =>
  request<FoodDto>("/foods/" + encodeURIComponent(id));
export const addFoodEntry = (input: EntryInput) =>
  request<{ entry: FoodEntry; revision: number }>(
    "/nutrition/entries",
    json("POST", input),
  );
export const updateFoodEntry = (id: string, input: EntryPatch) =>
  request<{ entry: FoodEntry; revision: number }>(
    "/nutrition/entries/" + encodeURIComponent(id),
    json("PATCH", input),
  );
export const deleteFoodEntry = (id: string, expectedRevision: number) =>
  request<{ revision: number }>(
    "/nutrition/entries/" + encodeURIComponent(id),
    json("DELETE", { expectedRevision }),
  );
export const setNutritionDayCompletion = (
  date: string,
  complete: boolean,
  expectedRevision: number,
) =>
  request<{ revision: number; completedAt: string | null }>(
    "/nutrition/days/" + date + "/completion",
    json("PUT", { complete, expectedRevision }),
  );
