import type { PrismaClient, Prisma } from "@prisma/client";
import { NutritionError, type FoodDto } from "@fitness/shared";
import { z } from "zod";
import { foodDto } from "./serializers";
const cursorSchema = z
  .object({ q: z.string(), id: z.string().min(1), name: z.string().min(1) })
  .strict();
export class FoodCatalog {
  constructor(private readonly db: PrismaClient) {}
  async search(input: {
    q: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: FoodDto[]; nextCursor: string | null }> {
    const { q, cursor, limit } = z
      .object({
        q: z
          .string()
          .trim()
          .max(100)
          .transform((s) => s.toLowerCase()),
        cursor: z.string().max(2000).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input);
    const where: Prisma.FoodWhereInput = {
      active: true,
      name: { contains: q, mode: "insensitive" },
    };
    if (cursor) {
      let c;
      try {
        c = cursorSchema.parse(
          JSON.parse(Buffer.from(cursor, "base64url").toString()),
        );
      } catch {
        throw new NutritionError("Invalid food search cursor");
      }
      if (c.q !== q)
        throw new NutritionError("Search changed; restart the results");
      where.AND = [
        { OR: [{ name: { gt: c.name } }, { name: c.name, id: { gt: c.id } }] },
      ];
    }
    const rows = await this.db.food.findMany({
      where,
      include: { portions: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit).map(foodDto);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({ q, id: last.id, name: last.name }),
            ).toString("base64url")
          : null,
    };
  }
  async get(id: string): Promise<FoodDto> {
    const row = await this.db.food.findFirst({
      where: { id, active: true },
      include: { portions: true },
    });
    if (!row) throw new NutritionError("Food not found", "NOT_FOUND", 404);
    return foodDto(row);
  }
}
