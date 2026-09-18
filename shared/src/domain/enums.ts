export const activityTypes = ["STRENGTH", "CARDIO", "SPORT"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const locations = ["GYM", "HOME"] as const;
export type Location = (typeof locations)[number];

export const genders = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
export type Gender = (typeof genders)[number];

export const workoutStatuses = ["PLANNED", "COMPLETED", "CANCELLED"] as const;
export type WorkoutStatus = (typeof workoutStatuses)[number];

export const cycleStatuses = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type CycleStatus = (typeof cycleStatuses)[number];

export const weightUnits = ["KG", "LB"] as const;
export type WeightUnit = (typeof weightUnits)[number];
