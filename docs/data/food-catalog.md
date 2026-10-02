# Food catalog

Source: USDA FoodData Central SR Legacy, April 2018. Public-domain data (CC0). Fixed URL and SHA-256 hashes are in `data/foods/source-manifest.json`. GitHub https://github.com/alyssaq/usda-sqlite is a structure reference only; its older SR28 data is not imported.

The initial reviewed selection has 135 basic foods from 7793 source records. All other records are excluded by explicit selection, not inferred to be invalid. Original English names retain raw/cooked/preparation distinctions.

Download the manifest ZIP, extract its JSON, then run:

```sh
npm run foods:import -- --input /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json --release 2018-04
```

Import verifies the JSON checksum and every selected record before a transaction updates the catalog. Repeating an import preserves IDs. Removed foods/portions are deactivated, and existing diary snapshots remain independent. Reports include created, updated, active and excluded counts. Never commit the large source archive.

Nutrients: 1008 kcal (preferred), 1062 kJ / 4.184 fallback, 1003 protein, 1004 fat, 1005 carbohydrate (grams). Missing or malformed required nutrients exclude a record; explicit zero is valid. Only approved whole-item portion IDs enable ea. Cups, slices and generic serving sizes do not become ea. No ml conversion.

## Source checks

| FDC ID | Description | kcal / 100g | Protein | Carbs | Fat | ea |
|---|---|---:|---:|---:|---:|---|
| 168877 | Rice, white, long-grain, regular, raw, enriched | 365 | 7.13 | 80.0 | 0.66 | g only |
| 168878 | Rice, white, long-grain, regular, enriched, cooked | 130 | 2.69 | 28.2 | 0.28 | g only |
| 171077 | Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw | 120 | 22.5 | 0.0 | 2.62 | g only |
| 171477 | Chicken, broilers or fryers, breast, meat only, cooked, roasted | 165 | 31.0 | 0.0 | 3.57 | g only |
| 171265 | Milk, whole, 3.25% milkfat, with added vitamin D | 61.0 | 3.15 | 4.8 | 3.25 | g only |
| 169705 | Oats (Includes foods for USDA's Food Distribution Program) | 389 | 16.9 | 66.3 | 6.9 | g only |
| 171413 | Oil, olive, salad or cooking | 884 | 0.0 | 0.0 | 100 | g only |
| 171287 | Egg, whole, raw, fresh | 143 | 12.6 | 0.72 | 9.51 | medium=44g; extra large=56g; small=38g; jumbo=63g; large=50g |
| 173424 | Egg, whole, cooked, hard-boiled | 155 | 12.6 | 1.12 | 10.6 | large=50g |
| 171688 | Apples, raw, with skin (Includes foods for USDA's Food Distribution Program) | 52.0 | 0.26 | 13.8 | 0.17 | medium (3" dia)=182g; small (2-3/4" dia)=149g; extra small (2-1/2" dia)=101g; large (3-1/4" dia)=223g |
| 173944 | Bananas, raw | 89.0 | 1.09 | 22.8 | 0.33 | extra large (9" or longer)=152g; large (8" to 8-7/8" long)=136g; small (6" to 6-7/8" long)=101g; extra small (less than 6" long)=81g; medium (7" to 7-7/8" long)=118g |
