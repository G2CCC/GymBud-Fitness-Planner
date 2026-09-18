const BODYWEIGHT_EQUIPMENT = "NONE";

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
