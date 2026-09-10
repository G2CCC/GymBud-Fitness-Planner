export const activityTypes = ["STRENGTH", "CARDIO", "SPORT"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const locations = ["GYM", "HOME"] as const;
export type Location = (typeof locations)[number];

export const workoutStatuses = ["PLANNED", "COMPLETED", "CANCELLED"] as const;
export type WorkoutStatus = (typeof workoutStatuses)[number];

export const workoutSources = ["ORIGINAL", "EXTRA"] as const;
export type WorkoutSource = (typeof workoutSources)[number];

export const cycleStatuses = ["DRAFT", "ACTIVE", "CLOSED", "PAUSED"] as const;
export type CycleStatus = (typeof cycleStatuses)[number];

export const weightUnits = ["KG", "LB"] as const;
export type WeightUnit = (typeof weightUnits)[number];
