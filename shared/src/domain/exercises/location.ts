import type { Location } from "../enums";

export type ExerciseLocationData = {
  availableLocations: readonly Location[];
};

const BODYWEIGHT_EQUIPMENT = "NONE";

export function isExerciseAvailableAtLocation(
  exercise: ExerciseLocationData,
  location: Location,
): boolean {
  return exercise.availableLocations.includes(location);
}

export function validateExerciseLocations(
  equipment: string | null | undefined,
  availableLocations: readonly Location[],
): void {
  if (availableLocations.length === 0) {
    throw new Error("An exercise must have at least one location");
  }

  if (new Set(availableLocations).size !== availableLocations.length) {
    throw new Error("An exercise cannot repeat a location");
  }

  const normalizedEquipment = normalizeEquipment(equipment);
  const isBodyweight = normalizedEquipment === BODYWEIGHT_EQUIPMENT;
  const supportsGym = availableLocations.includes("GYM");
  const supportsHome = availableLocations.includes("HOME");

  if (isBodyweight && (!supportsGym || !supportsHome)) {
    throw new Error("Bodyweight exercises must support both GYM and HOME");
  }

  if (!isBodyweight && (availableLocations.length !== 1 || !supportsGym)) {
    throw new Error("Equipment exercises can only support GYM");
  }
}

export function normalizeEquipment(
  equipment: string | null | undefined,
): string {
  const normalized = equipment?.trim();
  if (!normalized || normalized.length === 0) {
    return BODYWEIGHT_EQUIPMENT;
  }

  return normalized.toUpperCase() === BODYWEIGHT_EQUIPMENT
    ? BODYWEIGHT_EQUIPMENT
    : normalized;
}
