import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  normalizeFood,
  type SourceFood,
  type NormalizedFood,
} from "./transform";
export async function loadFoodSource(input: string, release: string) {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../data/foods/source-manifest.json", import.meta.url),
      "utf8",
    ),
  ) as { release: string; jsonSha256: string };
  if (release !== manifest.release) throw Error("Unrecognized food release");
  const bytes = await readFile(input);
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.jsonSha256)
    throw Error("Food source checksum does not match");
  const selection = JSON.parse(
    await readFile(
      new URL("../../data/foods/selection.json", import.meta.url),
      "utf8",
    ),
  ) as Array<{ fdcId: number; description: string; eaPortionIds: number[] }>;
  const raw = (JSON.parse(bytes.toString()) as { SRLegacyFoods: SourceFood[] })
    .SRLegacyFoods;
  const byId = new Map(raw.map((f) => [f.fdcId, f]));
  const rows: NormalizedFood[] = [];
  const excluded: Array<{ sourceId: string; reason: string }> = [];
  for (const selected of selection) {
    const food = byId.get(selected.fdcId);
    if (!food || food.description !== selected.description)
      throw Error(`Selection no longer matches source ${selected.fdcId}`);
    const row = normalizeFood(food, selected.eaPortionIds);
    if (row.status === "excluded") excluded.push(row);
    else rows.push(row);
  }
  // Incomplete staging never deactivates an existing catalog.
  if (excluded.length)
    throw Error(
      `Selected foods failed validation: ${JSON.stringify(excluded)}`,
    );
  return {
    rows,
    report: {
      release,
      sourceCount: raw.length,
      selected: selection.length,
      excludedCount: raw.length - rows.length,
      excludedReasons: {
        "outside-reviewed-basic-selection": raw.length - selection.length,
      },
      invalidSelected: excluded,
    },
  };
}
