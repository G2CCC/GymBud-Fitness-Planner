// Adult Compendium 2024, consulted 2026-10-02. Defaults are estimates, not measured intensity.
type ActivityEnergy = {
  met: number;
  referenceCode: string;
  source: string;
  assumption: string;
};
const entry = (
  met: number,
  referenceCode: string,
  section: string,
  assumption: string,
): ActivityEnergy => ({
  met,
  referenceCode,
  source: `https://pacompendium.com/${section}/`,
  assumption,
});
export const activityEnergy: Record<string, ActivityEnergy | null> = {
  "cardio-treadmill-running": entry(
    8.5,
    "12030",
    "running",
    "Level run at about 5 mph",
  ),
  "cardio-incline-treadmill-walking": entry(
    5.3,
    "17034",
    "walking",
    "Approximation using a 1–5% hill at a brisk walking pace",
  ),
  "cardio-outdoor-running": entry(
    7.5,
    "12020",
    "running",
    "Self-paced jogging",
  ),
  "cardio-stationary-bike": entry(
    6.8,
    "01200",
    "bicycling",
    "General stationary cycling",
  ),
  "cardio-outdoor-cycling": entry(7, "01014", "bicycling", "General cycling"),
  "cardio-rowing-machine": entry(
    5,
    "02071",
    "conditioning-exercise",
    "Below 100 watts",
  ),
  "cardio-elliptical": entry(
    5,
    "02048",
    "conditioning-exercise",
    "Moderate effort",
  ),
  "cardio-stair-climber": entry(
    9.3,
    "02065",
    "conditioning-exercise",
    "Stair ergometer",
  ),
  "cardio-air-bike": null, // Available source describes arms-only Airdyne, not this whole-body activity.
  "cardio-jump-rope": entry(
    11,
    "02068",
    "conditioning-exercise",
    "General skipping",
  ),
  "cardio-hiking": entry(5.3, "17082", "walking", "Normal pace, no load"),
  "cardio-ski-erg": entry(
    10.5,
    "02082",
    "conditioning-exercise",
    "Double poling at slow/moderate pace",
  ),
  "sport-basketball": entry(7.5, "15055", "sports", "General play"),
  "sport-soccer": entry(7, "15610", "sports", "Casual play"),
  "sport-cricket": entry(
    4.8,
    "15150",
    "sports",
    "Batting, bowling and fielding",
  ),
  "sport-rugby": entry(8.3, "15560", "sports", "Rugby union match"),
  "sport-boxing": entry(5.8, "15110", "sports", "Bag training"),
  "sport-golf": entry(4.5, "15255", "sports", "General play"),
  "sport-swimming": entry(
    5.8,
    "18240",
    "water-activities",
    "Slow freestyle laps",
  ),
  "sport-tennis": entry(6.8, "15675", "sports", "Moderate play"),
  "sport-table-tennis": entry(4, "15660", "sports", "General play"),
  "sport-badminton": entry(5.5, "15030", "sports", "Social play"),
  "sport-bouldering": entry(8.8, "15534", "sports", "Bouldering"),
  "sport-snowboarding": entry(
    7.5,
    "19201",
    "winter-activities",
    "Recreational mountain snowboarding",
  ),
  "sport-volleyball": entry(4, "15710", "sports", "General play"),
  "sport-baseball": entry(5, "15620", "sports", "Moderate play"),
  "sport-hockey": entry(
    7.8,
    "15350",
    "sports",
    "Field hockey default; not ice hockey",
  ),
  "sport-martial-arts": entry(
    5.3,
    "15425",
    "sports",
    "Novice practice at a slower pace",
  ),
  "sport-skiing": entry(
    6.3,
    "19160",
    "winter-activities",
    "Moderate downhill skiing; active minutes only",
  ),
  "sport-surfing": entry(
    3,
    "18220",
    "water-activities",
    "Recreational surfing",
  ),
};
export function getActivityEnergy(activityId: string): ActivityEnergy | null {
  return activityEnergy[activityId] ?? null;
}
