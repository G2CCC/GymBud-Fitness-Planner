export const FREE_EXERCISE_DB_COMMIT =
  "a859101d633a01c4a1a920d6a8ce41dabba0705f" as const;

export const FREE_EXERCISE_DB_JSON_URL =
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_COMMIT}/dist/exercises.json` as const;

export const FREE_EXERCISE_DB_RAW_BASE_URL =
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_COMMIT}/dist` as const;

export type SourceExercise = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  level: string | null;
  force: string | null;
  mechanic: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

export async function fetchExerciseDb(): Promise<readonly SourceExercise[]> {
  const localPath = process.env.CATALOG_SOURCE_FILE;
  const data: unknown = localPath
    ? JSON.parse(await readFile(localPath, "utf8"))
    : await (async () => {
        const response = await fetch(FREE_EXERCISE_DB_JSON_URL);
        if (!response.ok) {
          throw new Error(
            `free-exercise-db request failed with ${response.status} ${response.statusText}`,
          );
        }
        return response.json();
      })();
  if (!Array.isArray(data)) {
    throw new Error("free-exercise-db response was not an array");
  }

  return data as SourceExercise[];
}
import { readFile } from "node:fs/promises";
