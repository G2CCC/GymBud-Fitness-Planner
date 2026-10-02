# Estimated exercise energy v1

Reference: [2024 Adult Compendium](https://pacompendium.com/), consulted 2026-10-02.
The activity map in `server/src/catalog/activity-energy.ts` stores each source URL, code, MET and default assumption. Intensity, speed and load are not inferred from free text.

Energy is **additional to resting expenditure**: `(MET - 1) × body weight kg × hours`, bounded below at zero. It is an estimate, not a measurement or a claim of age-specific validity.

- Strength uses conditioning code 02054 (3.5 MET). Four seconds per repetition and default 60-second rests are GymBud heuristics, not measured Compendium timings. The final total is rounded once after summing actions.
- Current imported strength selection has 66 movements, not the entire upstream library. The explicit classification is reviewed with its source instructions. Plank is a static hold; Pallof Press includes a variable-duration hold. Both remain available but have no energy estimate. Unknown/new IDs are unsupported until classified. The remaining 64 movements use actual repetitions.
- Air Bike currently has no estimate: the identified Airdyne reference is arms-only and does not establish a whole-body air-bike value. Known exercise calories remain visible with partial coverage.
- Incline walking uses a hill-walking approximation; other defaults are listed in the map. Skiing uses active time only, excluding lifts. Hockey uses field hockey. These assumptions must be visible in the completed workout estimate explanation.
- Versions are `strength-energy-v1` and `duration-energy-v1`. Snapshots preserve body weight, reference code and inputs. Changing a profile does not recalculate old logs.

Sources: [conditioning](https://pacompendium.com/conditioning-exercise/), [cycling](https://pacompendium.com/bicycling/), [running](https://pacompendium.com/running/), [walking](https://pacompendium.com/walking/), [sports](https://pacompendium.com/sports/), [water](https://pacompendium.com/water-activities/), [winter](https://pacompendium.com/winter-activities/).
