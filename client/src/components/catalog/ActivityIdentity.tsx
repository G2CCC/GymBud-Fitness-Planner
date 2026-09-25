import type { ActivityType } from "@fitness/shared";
import type { ApiActivityOption } from "../../api/contracts";
import { ActivityIcon } from "./ActivityIcon";

export type ActivityDisplayOption = {
  name: string;
  iconKey: ApiActivityOption["iconKey"];
};

export const activityTypeLabels: Record<ActivityType, string> = {
  STRENGTH: "Strength",
  CARDIO: "Cardio",
  SPORT: "Sport",
};

export function getActivityDisplayName(
  activityType: ActivityType,
  activityOption?: ActivityDisplayOption | null,
  fallbackName?: string | null,
): string {
  return activityOption?.name ?? fallbackName ?? activityTypeLabels[activityType];
}

export function ActivityIdentity({
  activityType,
  activityOption,
  fallbackName,
  size = 20,
}: {
  activityType: ActivityType;
  activityOption?: ActivityDisplayOption | null;
  fallbackName?: string | null;
  size?: number;
}) {
  const name = getActivityDisplayName(activityType, activityOption, fallbackName);
  const broadLabel = activityTypeLabels[activityType];

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ActivityIcon
        iconKey={activityOption?.iconKey ?? "ACTIVITY"}
        label={name}
        size={size}
      />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        {name !== broadLabel ? (
          <span className="block truncate text-xs font-normal opacity-70">
            {broadLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}
