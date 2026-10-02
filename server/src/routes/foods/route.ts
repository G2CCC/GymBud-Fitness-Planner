import { Router } from "express";
import { db } from "../../db";
import { FoodCatalog } from "../../nutrition/catalog";
import { sendNutritionError } from "../../nutrition/http";
import { z } from "zod";
export const foodRouter = Router();
const catalog = new FoodCatalog(db);
foodRouter.get("/", async (req, res) => {
  try {
    const input = z
      .object({
        q: z.string().default(""),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      })
      .parse(req.query);
    return res.json({ data: await catalog.search(input) });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
foodRouter.get("/:id", async (req, res) => {
  try {
    return res.json({ data: await catalog.get(req.params.id) });
  } catch (e) {
    return sendNutritionError(res, e);
  }
});
