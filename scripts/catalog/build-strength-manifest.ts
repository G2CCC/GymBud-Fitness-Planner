import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StrengthCatalogSeed } from "@fitness/shared";
import {
  FREE_EXERCISE_DB_COMMIT,
  FREE_EXERCISE_DB_RAW_BASE_URL,
  fetchExerciseDb,
  type SourceExercise,
} from "./source";
import { selectedStrengthExercises as selections } from "./strength-selection";

const outputPath = "server/src/catalog/data/strength-exercises.ts";
const allowedCategories = new Set([
  "strength",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
]);

function buildManifest(source: readonly SourceExercise[]): StrengthCatalogSeed[] {
  const sourceById = new Map(source.map((exercise) => [exercise.id, exercise]));
  const selectedIds = new Set<string>();

  return selections.map((selection) => {
    if (selectedIds.has(selection.sourceId)) {
      throw new Error(`Duplicate curated source ID: ${selection.sourceId}`);
    }
    selectedIds.add(selection.sourceId);

    const exercise = sourceById.get(selection.sourceId);
    if (!exercise) {
      throw new Error(`Missing curated source ID: ${selection.sourceId}`);
    }
    if (!allowedCategories.has(exercise.category)) {
      throw new Error(`Unsupported category for ${exercise.id}: ${exercise.category}`);
    }
    if (exercise.images.length !== 2) {
      throw new Error(`Expected two images for ${exercise.id}`);
    }
    if (exercise.instructions.length === 0) {
      throw new Error(`Expected instructions for ${exercise.id}`);
    }

    const images = exercise.images.map((image) =>
      image.startsWith("http") ? image : `${FREE_EXERCISE_DB_RAW_BASE_URL}/${image}`,
    );

    return {
      id: `free-exercise-db-${exercise.id}`,
      sourceProvider: "free-exercise-db",
      sourceId: exercise.id,
      sourceCommit: FREE_EXERCISE_DB_COMMIT,
      sourceCategory: exercise.category,
      name: exercise.name,
      description: null,
      equipment: exercise.equipment === "body only" ? "NONE" : exercise.equipment,
      level: exercise.level,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      targetMuscles: [...exercise.primaryMuscles, ...exercise.secondaryMuscles],
      movementPattern: exercise.mechanic,
      instructions: exercise.instructions,
      images,
      primaryFocusArea: selection.primaryFocusArea,
      focusAreas: [...selection.focusAreas],
      imagePaths: [
        `free-exercise-db/${exercise.id}/0.jpg`,
        `free-exercise-db/${exercise.id}/1.jpg`,
      ],
      aiEligible: true,
    } satisfies StrengthCatalogSeed;
  });
}

function renderManifest(manifest: readonly StrengthCatalogSeed[]): string {
  return `import type { StrengthCatalogSeed } from "@fitness/shared";

export const selectedStrengthExercises = ${JSON.stringify(manifest, null, 2)} as const satisfies readonly StrengthCatalogSeed[];
`;
}

const source = await fetchExerciseDb();
const manifest = buildManifest(source);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, renderManifest(manifest), "utf8");
console.log(`Generated ${manifest.length} curated Strength exercises at ${outputPath}`);
