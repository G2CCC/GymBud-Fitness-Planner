import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { getAuthenticatedUserId } from "../../current-user";
import { NutritionDiary } from "../../nutrition/diary";
import { NutritionDays } from "../../nutrition/day";
import { sendNutritionError } from "../../nutrition/http";
export const nutritionRouter = Router();
const diary = new NutritionDiary(db);
const days = new NutritionDays(db);
nutritionRouter.get("/day", async (req, res) => {
  try {
    const date = z.string().parse(req.query.date);
    return res.json({
      data: await days.getDay(getAuthenticatedUserId(req), date),
    });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
nutritionRouter.post("/entries", async (req, res) => {
  try {
    return res.json({
      data: await diary.add(getAuthenticatedUserId(req), req.body),
    });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
nutritionRouter.patch("/entries/:id", async (req, res) => {
  try {
    return res.json({
      data: await diary.update(
        getAuthenticatedUserId(req),
        req.params.id,
        req.body,
      ),
    });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
nutritionRouter.delete("/entries/:id", async (req, res) => {
  try {
    const { expectedRevision } = z
      .object({ expectedRevision: z.number().int().nonnegative() })
      .strict()
      .parse(req.body);
    return res.json({
      data: await diary.remove(
        getAuthenticatedUserId(req),
        req.params.id,
        expectedRevision,
      ),
    });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
nutritionRouter.put("/days/:date/completion", async (req, res) => {
  try {
    return res.json({
      data: await diary.setCompletion(
        getAuthenticatedUserId(req),
        req.params.date,
        req.body,
      ),
    });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
