export const strengthFocusAreas = [
  "CHEST",
  "SHOULDERS",
  "BACK",
  "LEGS",
  "ARMS",
  "CORE",
] as const;

export type StrengthFocusArea = (typeof strengthFocusAreas)[number];

export const activityIconKeys = [
  "ACTIVITY",
  "BIKE",
  "FOOTPRINTS",
  "MOUNTAIN",
  "TROPHY",
  "WAVES",
  "TARGET",
  "CIRCLE_DOT",
  "SWORDS",
  "SNOWFLAKE",
] as const;

export type ActivityIconKey = (typeof activityIconKeys)[number];
export type ActivityOptionType = "CARDIO" | "SPORT";

export type StrengthCatalogSeed = {
  id: string;
  sourceProvider: "free-exercise-db";
  sourceId: string;
  sourceCommit: string;
  sourceCategory: string;
  name: string;
  description: string | null;
  equipment: string | null;
  level: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  targetMuscles: string[];
  movementPattern: string | null;
  instructions: string[];
  images: string[];
  primaryFocusArea: StrengthFocusArea;
  focusAreas: StrengthFocusArea[];
  imagePaths: string[];
  aiEligible: boolean;
};

export type ActivityOptionRecord = {
  id: string;
  activityType: ActivityOptionType;
  slug: string;
  name: string;
  iconKey: ActivityIconKey;
  aiEligible: boolean;
  sortOrder: number;
  description: string | null;
};
