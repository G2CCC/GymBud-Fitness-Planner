import { Prisma, PrismaClient } from "@prisma/client";
import {
  activityIconKeySchema,
  activityOptionTypeSchema,
  type ActivityIconKey,
  type ActivityOptionRecord,
  type ActivityOptionType,
} from "@fitness/shared";
import type { ExerciseRecord } from "../exercises/service";

const activityOptionSelect = {
  id: true,
  activityType: true,
  slug: true,
  name: true,
  iconKey: true,
  aiEligible: true,
  sortOrder: true,
  description: true,
} satisfies Prisma.ActivityOptionSelect;

export class ActivityCatalogService {
  constructor(private readonly prisma: PrismaClient) {}

  async listActivityOptions(
    activityType?: ActivityOptionType,
  ): Promise<ActivityOptionRecord[]> {
    const options = await this.prisma.activityOption.findMany({
      where: activityType ? { activityType } : undefined,
      select: activityOptionSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return options.flatMap((option) => {
      const serialized = serializeActivityOption(option);
      return serialized ? [serialized] : [];
    });
  }
}

function parseIconKey(value: string): ActivityIconKey {
  const parsed = activityIconKeySchema.safeParse(value);
  return parsed.success ? parsed.data : "ACTIVITY";
}

type ActivityOptionCandidate = {
  id: string;
  activityType: string;
  slug: string;
  name: string;
  iconKey: string;
  aiEligible: boolean;
  sortOrder: number;
  description: string | null;
};

export function serializeActivityOption(
  option: ActivityOptionCandidate | null | undefined,
): ActivityOptionRecord | null {
  if (!option) return null;

  const activityType = activityOptionTypeSchema.safeParse(option.activityType);
  if (!activityType.success) return null;

  return {
    ...option,
    activityType: activityType.data,
    iconKey: parseIconKey(option.iconKey),
  };
}

export type ApiExerciseCatalogRecord = {
  id: string;
  name: string;
  description: string | null;
  equipment: string | null;
  targetMuscles: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  focusAreas: string[];
  instructions: string[];
  imageUrls: string[];
  aiEligible: boolean;
};

export function serializeExercise(
  exercise: ExerciseRecord,
  options: { supabaseUrl: string; bucket: string },
): ApiExerciseCatalogRecord {
  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    equipment: exercise.equipment,
    targetMuscles: exercise.targetMuscles,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    focusAreas: exercise.focusAreas,
    instructions: exercise.instructions,
    imageUrls: exercise.imagePaths.map((path) =>
      buildPublicStorageUrl(options.supabaseUrl, options.bucket, path),
    ),
    aiEligible: exercise.aiEligible,
  };
}

function buildPublicStorageUrl(
  supabaseUrl: string,
  bucket: string,
  path: string,
): string {
  if (!supabaseUrl) return path;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}
