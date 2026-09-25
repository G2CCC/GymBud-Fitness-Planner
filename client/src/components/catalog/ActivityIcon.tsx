import {
  Activity,
  Bike,
  CircleDot,
  Footprints,
  Mountain,
  Snowflake,
  Swords,
  Target,
  Trophy,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { ActivityIconKey } from "@fitness/shared";

const iconMap: Record<ActivityIconKey, LucideIcon> = {
  ACTIVITY: Activity,
  BIKE: Bike,
  FOOTPRINTS: Footprints,
  MOUNTAIN: Mountain,
  TROPHY: Trophy,
  WAVES: Waves,
  TARGET: Target,
  CIRCLE_DOT: CircleDot,
  SWORDS: Swords,
  SNOWFLAKE: Snowflake,
};

export function ActivityIcon({
  iconKey,
  label,
  size = 20,
}: {
  iconKey: string;
  label: string;
  size?: number;
}) {
  const Icon = iconMap[iconKey as ActivityIconKey] ?? Activity;
  return <Icon aria-label={label} role="img" size={size} aria-hidden={false} />;
}
