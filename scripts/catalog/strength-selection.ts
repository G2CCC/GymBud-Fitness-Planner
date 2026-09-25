import type { StrengthFocusArea } from "@fitness/shared";

export type SelectedStrengthSelection = {
  sourceId: string;
  primaryFocusArea: StrengthFocusArea;
  focusAreas: readonly StrengthFocusArea[];
};

const selection = (
  sourceId: string,
  primaryFocusArea: StrengthFocusArea,
  focusAreas: readonly StrengthFocusArea[] = [primaryFocusArea],
): SelectedStrengthSelection => ({ sourceId, primaryFocusArea, focusAreas });

export const selectedStrengthExercises = [
  selection("Pushups", "CHEST"),
  selection("Barbell_Bench_Press_-_Medium_Grip", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Dumbbell_Bench_Press", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Incline_Dumbbell_Press", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Barbell_Incline_Bench_Press_-_Medium_Grip", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Decline_Dumbbell_Bench_Press", "CHEST"),
  selection("Cable_Chest_Press", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Incline_Cable_Chest_Press", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),
  selection("Flat_Bench_Cable_Flyes", "CHEST"),
  selection("Dips_-_Chest_Version", "CHEST", ["CHEST", "ARMS"]),
  selection("Machine_Bench_Press", "CHEST", ["CHEST", "SHOULDERS", "ARMS"]),

  selection("Barbell_Shoulder_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Dumbbell_Shoulder_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Arnold_Dumbbell_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Dumbbell_One-Arm_Shoulder_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Cable_Shoulder_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Seated_Cable_Shoulder_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Machine_Shoulder_Military_Press", "SHOULDERS", ["SHOULDERS", "ARMS"]),
  selection("Side_Lateral_Raise", "SHOULDERS"),
  selection("Front_Dumbbell_Raise", "SHOULDERS"),
  selection("Lying_Rear_Delt_Raise", "SHOULDERS", ["SHOULDERS", "BACK"]),
  selection("Face_Pull", "SHOULDERS", ["SHOULDERS", "BACK"]),

  selection("Full_Range-Of-Motion_Lat_Pulldown", "BACK", ["BACK", "ARMS"]),
  selection("Pullups", "BACK", ["BACK", "ARMS"]),
  selection("Weighted_Pull_Ups", "BACK", ["BACK", "ARMS"]),
  selection("Bent_Over_Barbell_Row", "BACK", ["BACK", "ARMS"]),
  selection("One-Arm_Dumbbell_Row", "BACK", ["BACK", "ARMS"]),
  selection("Seated_Cable_Rows", "BACK", ["BACK", "ARMS"]),
  selection("T-Bar_Row_with_Handle", "BACK", ["BACK", "ARMS"]),
  selection("Inverted_Row", "BACK", ["BACK", "ARMS"]),
  selection("Barbell_Deadlift", "BACK", ["BACK", "LEGS"]),
  selection("Trap_Bar_Deadlift", "BACK", ["BACK", "LEGS"]),
  selection("Hyperextensions_Back_Extensions", "BACK", ["BACK", "LEGS"]),

  selection("Barbell_Squat", "LEGS", ["LEGS", "BACK"]),
  selection("Bodyweight_Squat", "LEGS"),
  selection("Front_Barbell_Squat", "LEGS", ["LEGS", "BACK"]),
  selection("Goblet_Squat", "LEGS"),
  selection("Leg_Press", "LEGS"),
  selection("Dumbbell_Lunges", "LEGS"),
  selection("Barbell_Walking_Lunge", "LEGS"),
  selection("Romanian_Deadlift", "LEGS", ["LEGS", "BACK"]),
  selection("Lying_Leg_Curls", "LEGS"),
  selection("Leg_Extensions", "LEGS"),
  selection("Standing_Calf_Raises", "LEGS"),

  selection("Barbell_Curl", "ARMS"),
  selection("Hammer_Curls", "ARMS"),
  selection("Dumbbell_Bicep_Curl", "ARMS"),
  selection("Preacher_Curl", "ARMS"),
  selection("Concentration_Curls", "ARMS"),
  selection("Triceps_Pushdown", "ARMS"),
  selection("Triceps_Pushdown_-_Rope_Attachment", "ARMS"),
  selection("Dips_-_Triceps_Version", "ARMS", ["ARMS", "CHEST"]),
  selection("Lying_Triceps_Press", "ARMS"),
  selection("Standing_Dumbbell_Triceps_Extension", "ARMS"),
  selection("Reverse_Grip_Triceps_Pushdown", "ARMS"),

  selection("Plank", "CORE"),
  selection("Crunches", "CORE"),
  selection("Cable_Crunch", "CORE"),
  selection("Hanging_Leg_Raise", "CORE", ["CORE", "ARMS"]),
  selection("Reverse_Crunch", "CORE"),
  selection("Ab_Crunch_Machine", "CORE"),
  selection("Decline_Crunch", "CORE"),
  selection("Oblique_Crunches", "CORE"),
  selection("Exercise_Ball_Crunch", "CORE"),
  selection("Flat_Bench_Lying_Leg_Raise", "CORE"),
  selection("Pallof_Press", "CORE", ["CORE", "SHOULDERS"]),
] as const satisfies readonly SelectedStrengthSelection[];
