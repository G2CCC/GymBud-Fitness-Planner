export const activityTypes = ["STRENGTH", "CARDIO", "SPORT"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const sexes = ["MALE", "FEMALE"] as const;
export type Sex = (typeof sexes)[number];

export const workoutStatuses = ["PLANNED", "COMPLETED"] as const;
export type WorkoutStatus = (typeof workoutStatuses)[number];

export const cycleStatuses = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type CycleStatus = (typeof cycleStatuses)[number];

export const weightUnits = ["KG", "LB"] as const;
export type WeightUnit = (typeof weightUnits)[number];

export const bodyGoals = ["FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE"] as const;
export type BodyGoal = (typeof bodyGoals)[number];
