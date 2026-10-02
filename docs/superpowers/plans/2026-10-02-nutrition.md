# GymBud Nutrition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 GymBud 交付固定营养目标、四餐饮食记录、训练消耗估算和周期营养复盘。

**Architecture:** 在现有 React / Express / shared / Prisma 结构内扩展。shared 提供可测试的计算与校验；服务端保存来源和计算快照，通过查询汇总净摄入，不维护一个不断加减的余额变量。复盘使用独立、不可变的营养摘要，保留现有训练量结构。

**Tech Stack:** TypeScript、React 19、Express 5、Zod 3、Prisma 6、PostgreSQL、Vitest、Testing Library、Playwright；沿用现有 npm workspaces 与 Node 22 环境。

**Spec:** [GymBud-Nutrition-Design-v1.md](../specs/2026-10-02-nutrition-design.md)。用户已确认该稿及第 14 节全部默认参数；稿内“待审阅”文字保留为原始版本记录。进入开发时将已确认稿放入 `docs/superpowers/specs/2026-10-02-nutrition-design.md`，更新本引用。

**Repository baseline:** `G2CCC/GymBud-Fitness-Planner`，读取的提交为 `f9c77517c21a344b1029ec6b8c8cd48d7d382143`；该树未发现 AGENTS.md。执行时重新核对 HEAD、工作区和新增的仓库指令，不能覆盖别人的改动。本文件是实施计划，尚未修改产品代码或数据库，也未执行下述测试。

## Global Constraints

- Sex 仅 `MALE` / `FEMALE`；BodyGoal 仅 `FAT_LOSS` / `MUSCLE_GAIN` / `MAINTENANCE`。
- 保留既有年龄输入与范围；统一公式使用 age，不新增年龄算法分支或活动等级字段。
- 净摄入 = 饮食摄入 − 已完成训练的估算消耗；固定净热量和宏量目标不随训练变化。
- 算法由后端确定，AI 不计算或修改目标；不提供目标、消耗的手工覆盖。
- 力量无实际时长字段；有氧/运动沿用 actualDurationMinutes。
- `nutrition-v1`；力量算法 `strength-energy-v1`；时长型算法本计划命名 `duration-energy-v1`。
- 食物为英文基础食品，单位 `g` / 有可靠换算的 `ea`，不提供 ml、品牌、私人食品、食谱、扫码。
- 餐次 `BREAKFAST` / `LUNCH` / `DINNER` / `SNACK`；初次无记录显示未记录。
- 只有食物增删改取消当日完整确认；目标和训练变化不取消确认。
- 不依赖 ACTIVE 训练周期；不允许未来实际食物记录；不生成首次目标之前的假目标。
- 只对明确隔离的开发/测试库重建测试数据；无真实用户兼容和历史回填；不删除无关迁移。
- 使用现有样式与英文产品文案；普通标题、列表、分隔线，不引入新 UI 框架。
- 所有测试数据库必须隔离；测试被 skip、环境缺失或命令未运行均不能报告为通过。

## Review Focus

1. 同一 clientRequestId 重试、相同 ID 携带不同内容，以及两个页面并发增改：不重复计数、不静默丢记录，冲突可恢复。由任务 6、9、12 验证。
2. 食物停用或营养更新后再编辑旧餐：沿用旧基准和单个重量；换食物才换快照。由任务 5、6 验证。
3. Auckland 午夜、夏令时、旅行更换时区及补登记：既有日期/训练归属不漂移，目标不逆向污染历史。由任务 2、4、7、8 验证。
4. 静态动作、零次组、部分覆盖及已有草稿日志：零消耗与未知消耗可区分；不能凭未完成或非法日志抵扣。由任务 3、7、8 验证。
5. 生成复盘期间改饮食、AI 失败重试与样本不足：统计和解释来自同一快照，不把缺失当零。由任务 10、11、12 验证。

---

## 文件与职责

以下均为仓库相对路径；`新增`文件尚不存在。不重构无关目录。

| 范围 | 文件 | 职责 |
| --- | --- | --- |
| 资料与持久化 | `prisma/schema.prisma`；新增 `prisma/migrations/<timestamp>_nutrition/migration.sql` | 新枚举、五个模型、训练和复盘扩展 |
| 资料边界 | `shared/src/domain/{enums,types,validation}.ts`；`client/src/components/onboarding/ProfileForm.tsx`；`server/src/routes/profile/route.ts`；新增 `server/src/profiles/service.ts` | 资料字段、单选目标、原子保存目标 |
| 营养领域（新增） | `shared/src/domain/nutrition/{types,validation,targets,portions,day,summary}.ts` | 共用类型、公式、份量、日/周期汇总 |
| 消耗领域（新增） | `shared/src/domain/workouts/energy.ts`；`server/src/catalog/{activity-energy,strength-energy}.ts` | 估算纯函数、版本化活动映射 |
| 食物数据（新增） | `scripts/foods/{source,transform,import}.ts`；`data/foods/{source-manifest,selection}.json`；`docs/data/food-catalog.md` | 固定来源、清洗、幂等导入与人工审阅记录 |
| 服务端营养（新增） | `server/src/nutrition/{catalog,targets,diary,day,summary,serializers}.ts` | 食物查询、目标版本、日记事务、读模型、数据库小数转换 |
| 路由（新增） | `server/src/routes/foods/route.ts`；`server/src/routes/nutrition/route.ts` | 认证后的薄接口；在 `server/src/routes/index.ts` 注册 |
| 训练集成 | `server/src/workouts/service.ts`；`server/src/routes/workouts/route.ts`；`shared/src/domain/workouts/validation.ts` | 完成、补登记、日志编辑统一估算 |
| 客户端 API | `client/src/api/{client,contracts}.ts`；新增 `client/src/api/nutrition.ts` | 复用 request、显式 DTO、饮食端点 |
| 饮食 UI（新增） | `client/src/pages/nutrition/NutritionPage.tsx`；`client/src/components/nutrition/{DailyNutritionSummary,MealSection,FoodEntryDialog,FoodSearch}.tsx` | 每日页面和最小组件分工 |
| 导航与资料 UI | `client/src/{App,router}.tsx`；`client/src/pages/{profile/ProfilePage,onboarding/OnboardingPage}.tsx` | 四项导航、资料保存、记录时区 |
| 训练 UI | `client/src/pages/workouts/WorkoutPage.tsx`；`client/src/pages/calendar/CalendarPage.tsx`；`client/src/components/calendar/WorkoutDetailsDrawer.tsx`；`client/src/components/workouts/{StrengthLogForm,CardioLogForm,SportLogForm,WorkoutLogSummary}.tsx` | 合法完成入口、消耗解释、覆盖提示 |
| 周复盘 | `server/src/reviews/service.ts`；`server/src/ai/{schemas,fake-client}.ts`；`server/src/ai/prompts/review.ts`；`client/src/pages/review/ReviewPage.tsx` | 一致快照、AI 解释与展示 |
| 共享导出与初始化 | `shared/src/index.ts`；`server/src/current-user.ts`；`prisma/seed.ts`；`package.json` | 导出、测试用户、导入命令 |
| 测试 | 下述各任务的精确测试路径 | 纯函数、数据库事务、UI 和端到端验证 |

涉及 gender/自由文本目标的旧 fixtures、AI profile 输入和测试按任务 1 的引用清单同步修改；不能只改表单而留下另一条写入路径。

## 统一接口与存储约定

由任务 2 在 `shared/src/domain/nutrition/types.ts` 定义并从 shared 导出；任务 1 的 schema 与这些名称一致：

```ts
type LocalDate = string; // 经 schema 验证的 YYYY-MM-DD，不直接转 UTC Date
type NutritionTotals = { kcal: number; proteinG: number; carbsG: number; fatG: number };
type NutritionProfile = {
  sex: "MALE" | "FEMALE"; age: number; heightCm: number; weightKg: number;
  primaryGoal: "FAT_LOSS" | "MUSCLE_GAIN" | "MAINTENANCE";
};
type TargetValues = NutritionTotals & { algorithmVersion: "nutrition-v1" };
type FoodUnit = "g" | "ea";
type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type FoodSnapshot = { name: string; per100g: NutritionTotals; unitGrams: number | null };
type EnergyCoverage = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
type EnergyEstimate = {
  estimatedKcal: number | null; coverage: EnergyCoverage;
  method: "STRENGTH_REPS" | "ACTIVITY_DURATION";
  version: "strength-energy-v1" | "duration-energy-v1";
  inputs: Record<string, unknown>;
};
type EntryInput = {
  date: LocalDate; mealType: MealType; foodId: string;
  portionId?: string; quantity: number; unit: FoodUnit;
  clientRequestId: string; expectedRevision: number;
};
type EntryPatch = Pick<EntryInput, "mealType" | "quantity" | "unit" | "expectedRevision">
  & { foodId?: string; portionId?: string };
type FoodEntry = {
  id: string; foodId: string; portionId: string | null; mealType: MealType;
  quantity: number; unit: FoodUnit; grams: number;
  snapshot: FoodSnapshot; totals: NutritionTotals;
};
type DayEnergy = {
  estimatedKcal: number; coverage: EnergyCoverage;
  workouts: Array<{ workoutId: string; estimatedKcal: number | null; coverage: EnergyCoverage }>;
};
type NutritionDayDto = {
  date: LocalDate; timezone: string; revision: number; completedAt: string | null;
  target: TargetValues | null; entries: FoodEntry[];
  food: NutritionTotals; exercise: DayEnergy; netKcal: number; remainingKcal: number | null;
  recorded: boolean; // 有食物或已确认空白日
};
```

- `NutritionDay.localDate`、`NutritionTarget.effectiveDate` 和 `WorkoutLog.completedLocalDate` 用严格 10 位字符串保存；Zod 校验真实日期。时间戳用 UTC。这样避免 Prisma DATE 序列化再引入 UTC 日期偏移。
- UserProfile 新增 `recordingTimezone`（有效 IANA 标识）和 `nutritionStartedOn`；首次资料保存生成。前端设备时区作为候选，服务器验证。既有 NutritionDay.timezone 固定，未来新建日采用当前记录时区。
- Food 来源唯一键 `[sourceProvider, sourceRelease, sourceId]`；FoodPortion 来源键 `[foodId, sourcePortionId]`，保留原始 label、quantity、grams 和明确的 `unitGrams`。
- NutritionTarget 唯一键 `[userId, effectiveDate]`，同日 upsert；保存四项目标与 profileSnapshot。NutritionDay 唯一键 `[userId, localDate]`，revision 初始 0。
- FoodLog 除设计字段外增加 userId、per100gSnapshot、unitGramsSnapshot、requestFingerprint、deletedAt；`[userId, clientRequestId]` 唯一。软删除保留重试标识，汇总排除 deletedAt 非空记录；不再创建额外“余额”表。
- 热量目标 Int；目标宏量 Decimal(12,1)；目录与日志营养/重量 Decimal(14,4)；消耗最终保存整数 kcal，inputs 保留未取整动作结果。API 由 serializers 显式输出有限 number。
- 错误统一使用现有项目响应 envelope：400 `VALIDATION_ERROR` / `INVALID_TARGET`，404 不存在或无权限，409 `REVISION_CONFLICT` / `IDEMPOTENCY_CONFLICT`。不相信 body.userId 或客户端营养值。
- 周期摘要类型由任务 10 定义；不要把 `objectiveSummary` 从现有训练量格式替换成另一种对象。

## 执行顺序

按 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 顺序。任务提交属于同一 feature 分支；中途不发布未完成的 UI。每个任务只提交自身文件及必要引用修正，避免 `git add .`。

### Task 1: 资料枚举与数据库结构

**Files:** 修改 schema、shared 枚举/资料类型/校验、ProfileForm、API contracts、Profile route、`server/src/current-user.ts`；新增迁移和 `server/tests/integration/nutrition-schema.test.ts`；更新 `shared/tests/domain/profile-validation.test.ts`、`client/tests/ui/profile.test.tsx` 及受影响 fixtures。

**Interfaces:** ProfileInput 使用 `sex` 与 BodyGoal；数据库生成五个新模型以及统一约定中的列、索引、关系。当前资料 route 暂只适配新字段，原子目标写入由任务 4 接管。

- [ ] 在隔离工作区记录基线，读取实际 AGENTS；`rg -n 'NON_BINARY|PREFER_NOT_TO_SAY|\bgender\b|primaryGoal' client server shared prisma tests`，将真实受影响文件列入本任务。将确认的 spec 和本计划纳入分支文档。
- [ ] 写失败测试：以既有有效 profile fixture 为基准替换 sex/goal，断言以下边界；schema 集成测试验证唯一约束与模型关系。

```ts
expect(profileSchema.safeParse({ ...validProfile, sex: "FEMALE", primaryGoal: "MAINTENANCE" }).success).toBe(true);
expect(profileSchema.safeParse({ ...validProfile, sex: "NON_BINARY" }).success).toBe(false);
expect(profileSchema.safeParse({ ...validProfile, primaryGoal: "get fitter" }).success).toBe(false);
// profileSchema 是测试对现有资料 schema 导出的别名，不另造第二份校验。
```

- [ ] 运行 `npx vitest run --project node shared/tests/domain/profile-validation.test.ts server/tests/integration/nutrition-schema.test.ts`，确认因新枚举/模型未实现而失败。
- [ ] 落实 schema 与新迁移；移除 Gender 定义和旧选项，保留原年龄/身高/体重约束。更新引用、测试 seed 和 AI 的 profile 输入字段，不新增旧值转换器。新迁移允许空数据库完整迁移链执行；不对用户未知数据库执行 reset。
- [ ] 在隔离库执行 `npm run db:generate`、`npx prisma migrate deploy --schema prisma/schema.prisma`、`npx prisma validate --schema prisma/schema.prisma`；重跑测试与 `npm run typecheck`，应通过，数据库测试不可跳过。
- [ ] 提交：`feat: add nutrition schema and simplify profile goals`，包含枚举、迁移、引用修正及本任务测试。

### Task 2: 固定目标、份量与日期领域函数

**Files:** 新增 shared nutrition `types.ts`、`validation.ts`、`targets.ts`、`portions.ts`；复用/必要时扩展 `shared/src/domain/time/timezone.ts`；修改 shared 导出；新增 `shared/tests/domain/{nutrition-targets,nutrition-portions,nutrition-dates}.test.ts`。

**Interfaces:** `calculateNutritionTarget(profile: NutritionProfile): TargetValues`；`calculateFoodPortion(snapshot: FoodSnapshot, unit: FoodUnit, quantity: number): { grams: number; totals: NutritionTotals }`；`nutritionLocalDate(at: Date, timezone: string): LocalDate`。非法值抛可映射到 400 的领域错误。

- [ ] 写失败测试，除下面样例外覆盖 FEMALE 偏移 −161、三个目标、非有限值、负碳水、非法日期、quantity ≤ 0 和 ea 无单个重量。

```ts
expect(calculateNutritionTarget({ sex: "MALE", age: 27, heightCm: 180, weightKg: 80, primaryGoal: "FAT_LOSS" }))
  .toEqual({ kcal: 1939, proteinG: 144, fatG: 64.6, carbsG: 195.3, algorithmVersion: "nutrition-v1" });
const egg = { name: "Egg", per100g: { kcal: 140, proteinG: 12, carbsG: 1, fatG: 10 }, unitGrams: 50 };
expect(calculateFoodPortion(egg, "ea", 1.5)).toEqual(calculateFoodPortion(egg, "g", 75));
expect(nutritionLocalDate(new Date("2026-09-26T14:30:00Z"), "Pacific/Auckland")).toBe("2026-09-27");
```

- [ ] 运行 `npx vitest run --project node shared/tests/domain/nutrition-targets.test.ts shared/tests/domain/nutrition-portions.test.ts shared/tests/domain/nutrition-dates.test.ts`，预期缺导出而失败。
- [ ] 实现：R=10W+6.25H−5age+S，baseline=R×1.2；目标系数 .90/1.05/1；先将 kcal 四舍五入为整数，再用未取整的蛋白/脂肪算碳水，宏量最后保留 0.1g。蛋白1.8/1.6g/kg、脂肪30%；不读取训练字段。份量按克线性缩放全部四项，保持精度，禁止 ml 猜测。日期使用 Intl/现有时区工具，严格校验 YYYY-MM-DD 的真实日期。
- [ ] 重跑上条命令，增肌样例应为 2262/144/251.9/75.4，维持为 2154/128/249/71.8；全部通过后提交 `feat: calculate fixed nutrition targets and food portions`。

### Task 3: 训练消耗纯函数与映射覆盖

**Files:** 新增 `shared/src/domain/workouts/energy.ts`、`server/src/catalog/{activity-energy,strength-energy}.ts`、`docs/data/exercise-energy.md`、`shared/tests/domain/workout-energy.test.ts`、`server/tests/integration/energy-catalog.test.ts`；修改 shared 导出。

**Interfaces:** 定义 `StrengthEnergyItem = { exerciseId: string; supported: boolean; restSeconds?: number | null; sets: Array<{ actualReps: number }> }`；`estimateStrengthEnergy(items: StrengthEnergyItem[], bodyWeightKg: number): EnergyEstimate`；`estimateDurationEnergy(input: { activityId: string; minutes: number; met: number | null; bodyWeightKg: number; referenceCode: string | null }): EnergyEstimate`；服务端导出 `getActivityEnergy(activityId): { met: number; referenceCode: string } | null` 和 `isStrengthEnergySupported(exerciseId): boolean`。

- [ ] 写失败测试：80kg、3×10、休息60秒的单动作未取整值为 13.333…，最终13kcal；两个同动作最终27而非26；rest=0 时7kcal；零次组不增休息；改变实际负重不改变输入结果。静态动作单独出现返回 null/UNAVAILABLE，混合返回已知小计/PARTIAL；已支持但全零次为0/COMPLETE。

```ts
const item = { exerciseId: "test-reps", supported: true, restSeconds: 60, sets: [{ actualReps: 10 }, { actualReps: 10 }, { actualReps: 10 }] };
expect(estimateStrengthEnergy([item, item], 80).estimatedKcal).toBe(27);
expect(estimateDurationEnergy({ activityId: "test", minutes: 30, met: 5, bodyWeightKg: 80, referenceCode: "fixture" }).estimatedKcal).toBe(160);
```

- [ ] 运行 `npx vitest run --project node shared/tests/domain/workout-energy.test.ts server/tests/integration/energy-catalog.test.ts`，预期缺估算器/映射而失败。
- [ ] 实现 MET3.5、每次4秒、默认休息60秒，使用 `??` 保留显式0；extra=max(0,MET−1)×kg×小时；按动作保留未取整输入/结果，总和最后 `Math.round`。所有数值有限且非负；缺少必要资料不能默认成0。覆盖定义以未支持条目是否实际参与本次日志为准。
- [ ] 为现有12个 cardio、18个 sport 的每个 ActivityOption.id 建立可追溯 Compendium 条目和版本记录，无法确认则显式 null/unsupported 并写原因。动作目录逐条可归类为 reps 或 unsupported，静态保持列出明确 ID；测试全目录没有未分类 ID。不依据名字运行时猜 MET，不任意叠加强度倍率。记录来源 URL、参考 code、查阅日期及近似默认档位。
- [ ] 重跑上条命令；检查所有活动已映射或明确不支持，所有动作已分类，再提交 `feat: estimate workout energy with versioned coverage`。

### Task 4: 原子保存资料与每日有效目标

**Files:** 新增 `server/src/profiles/service.ts`、`server/src/nutrition/targets.ts`、`server/tests/integration/nutrition-targets.test.ts`；修改 profile route、ProfileForm、ProfilePage、OnboardingPage、API 资料类型和测试用户初始化。

**Interfaces:** `ProfileService.saveProfile(userId: string, input: ProfileInput, now?: Date): Promise<ProfileInput>` 取代 route 直接 upsert，保持现有资料接口形状；`getTargetForDate(tx: Prisma.TransactionClient, userId: string, date: LocalDate): Promise<TargetValues | null>` 查询 effectiveDate≤date 的最新版本。ProfileInput 在任务1增加 recordingTimezone；首次 profile 保存携带该值；已存在用户未提供时保留已存时区，不静默覆盖为 UTC。

- [ ] 写失败集成测试：资料和目标一起提交；公式错误时两者都不变；10月2日改变体重只改变2日及以后；同日第二次保存只有一个有效版本；只改 weeklyTrainingDays 不增目标；首次版本之前查询 null。

```ts
expect(targetOnYesterday.kcal).toBe(1939);
expect(targetOnToday.kcal).not.toBe(targetOnYesterday.kcal);
expect(sameDayRows).toHaveLength(1);
expect(profileAfterInvalidSave).toEqual(profileBeforeInvalidSave);
```

- [ ] 运行 `npx vitest run --project node server/tests/integration/nutrition-targets.test.ts`，应因缺目标版本而失败。
- [ ] 实现短事务：验证资料→计算→保存资料及当日版本；创建 nutritionStartedOn。目标快照仅含用于公式的身体数据与版本。记录时区改变仅用于新建日期；若新时区“今天”早于已经生成的最新生效日，目标生效日取两者较晚者，避免跨日期线回改历史。该规则写入代码注释和测试。既有日 timezone 不更新。
- [ ] 更新资料 UI 的 Sex/Goal 三选与保存请求；OnboardingPage 现有顺序是 saveProfile 后 createCycleDraft，保留该顺序，不把目标生成放进周期创建。无周期仍可 saveProfile 和读目标。首次保存使用设备 IANA 时区；切换设备时区只提交 recordingTimezone 更新，不重写已有归属。
- [ ] 重跑上条命令及 `npx vitest run --project client client/tests/ui/profile.test.tsx`、`npm run typecheck`，通过后提交 `feat: persist effective nutrition targets with profiles`。

### Task 5: 固定食物库导入与搜索

**Files:** 新增文件映射中的 scripts/foods、data/foods、docs/data/food-catalog.md、`server/src/nutrition/{catalog,serializers}.ts`、foods route；修改 routes/index、package scripts；新增 `server/tests/integration/{food-import,food-catalog}.test.ts` 和 `scripts/foods/transform.test.ts`。

**Interfaces:** `normalizeFood(source: SourceFood): NormalizedFood | ExcludedFood`（这两种类型在 transform.ts 明确定义）；`importFoods(db, rows: NormalizedFood[], release: string): Promise<ImportReport>`；`FoodCatalog.search({ q, cursor?, limit }): Promise<{ items: FoodDto[]; nextCursor: string | null }>`；`FoodCatalog.get(id: string): Promise<FoodDto>`。FoodDto 包含 id/name/per100g/portions，portions 明确 unitGrams；limit 默认20，上限50。

- [ ] 写失败测试：kcal 优先于 kJ，只有 kJ 则除4.184；缺一个宏量排除，来源明确0保留；2个100g→1ea50g；cup/slice 不当 ea；raw/cooked 分开；重复导入不重复，停用不删引用；搜索 cursor 稳定，不泄漏未启用条目。

```ts
expect(kjOnly.per100g.kcal).toBeCloseTo(100); // 源能量418.4kJ
expect(twoEggs.unitGrams).toBe(50); // 源份量2个，共100g
expect(missingProtein.status).toBe("excluded");
expect(importAgain.created).toBe(0);
expect(oldFoodLog.totals).toEqual(beforeImport.totals);
```

- [ ] 运行 `npx vitest run --project node scripts/foods/transform.test.ts server/tests/integration/food-import.test.ts server/tests/integration/food-catalog.test.ts`，应因导入器/接口缺失而失败。
- [ ] 下载 USDA 官方 SR Legacy 固定发布数据，核实源格式的 nutrient ID 与单位；manifest 写入真实 release、URL、SHA256、许可和选取规则，不写虚构校验和。GitHub alyssaq/usda-sqlite 只作为组织参考，不能悄悄替换成 SR28。保留原始数据的外部获取方式和校验，不把巨大原包塞进 git。
- [ ] 实现纯转换器与确定性筛选清单；按来源键 upsert，完整验证和 staging 成功后才把该来源被移除条目标为 inactive，失败导入不批量下架。产出 created/updated/active/excluded 与原因报告。注册 `foods:import` npm script，参数 `--input <path> --release <manifest-release>`，禁止未知 release/checksum。
- [ ] 实现 GET `/api/foods` 和 `/:id`；使用参数化 Prisma 查询，按 name/id 排序并让 cursor 绑定搜索词；无效 cursor400。序列化 Decimal。抽样核对米饭生熟、鸡肉生熟、鸡蛋、牛奶、燕麦、苹果、香蕉、油，并将实际 sourceId 与ea判定写入数据文档。
- [ ] 重跑测试，在隔离库执行导入两次并检查报告；检索和条数一致，第二次 created=0。提交 `feat: import and search a sourced basic food catalog`。

### Task 6: 日记写入、完整确认与并发控制

**Files:** 新增 `server/src/nutrition/diary.ts`、nutrition route、`server/tests/integration/nutrition-diary.test.ts`；扩展 shared nutrition validation、serializers；注册路由。

**Interfaces:** `NutritionDiary.add(userId, input: EntryInput): Promise<{ entry: FoodEntry; revision: number }>`；`update(userId, id, input: EntryPatch)` 返回相同形状；`remove(userId, id, expectedRevision): Promise<{ revision: number }>`；`setCompletion(userId, date, { complete: boolean, expectedRevision: number }): Promise<{ completedAt: string | null; revision: number }>`。DELETE 的 expectedRevision 放 JSON body；PATCH 本版不跨日期搬餐。

- [ ] 写失败测试：认证用户隔离、portion/food不匹配、拒绝客户端 kcal、未来/开始前日期400；添加后取消完整；确认空白日允许；修改停用食物数量沿旧 per100g/unitGrams；换食品重新 snapshot。
- [ ] 写 Review Focus 并发断言：相同 requestId+相同规范化输入仅一条；相同 ID 改数量409；软删除后重试旧 POST 不复活，返回409；两个 revision=0 的并发新增一成功一409，冲突者刷新重试后两条都存在；完整确认与编辑抢同一 revision 至多一个成功。

```ts
expect(activeEntriesForRequest).toHaveLength(1);
expect(conflictingPayload.status).toBe(409);
expect(afterRetry.entries).toHaveLength(2);
expect(afterEdit.completedAt).toBeNull();
expect(afterCatalogChange.entries[0].snapshot.per100g).toEqual(originalPer100g);
```

- [ ] 运行 `npx vitest run --project node server/tests/integration/nutrition-diary.test.ts`，应失败于接口不存在/事务规则未实现。
- [ ] 实现短事务：获取或唯一创建日→校验归属→按 expectedRevision CAS 增 revision→写日志/删除标记/完整状态。任何步骤失败全部回滚。requestFingerprint 排除 expectedRevision，包含 date/meal/food/portion/unit/quantity；POST 幂等检查在 CAS 之前，同 payload 重试返回既有记录和当前日 revision。数据库唯一冲突重新读取分类，不泄漏数据库错误。
- [ ] 编辑未换食品时只用旧快照允许的 g/ea；不能借部分 PATCH 使用目录新规格。明确换 foodId/portionId 时查启用目录并换快照。所有计算由服务器执行，写入的用户 ID 来自认证上下文。
- [ ] 重跑上条测试；两个用户交叉访问均404、冲突无部分写入、删除不再汇总。提交 `feat: add revision-safe nutrition diary mutations`。

### Task 7: 完成、补登记与编辑训练统一写入消耗

**Files:** 修改 workouts service、route、shared workouts validation、client API/contracts、WorkoutPage、CalendarPage、WorkoutDetailsDrawer、WorkoutLogSummary 及相关三类日志表单；新增 `server/tests/integration/workout-energy.test.ts`，更新 `server/tests/integration/workout-log.test.ts`。

**Interfaces:** 保留 `completeWorkout(userId, workoutId, { completedAt?, log? }, now?)`；补登记 schema 增加可选 log 并复用完成路径；无新 log 时仅允许读取已保存且有效的 log。`WorkoutLog.estimatedCaloriesKcal` 对外映射为 energy.estimatedKcal，连同 coverage/version/inputs 返回；UI 不自己重算。

- [ ] 写失败集成测试：三种训练无日志不能完成；已有合法草稿可以完成；cardio无actualDuration失败；strength只用实际组；PLANNED不汇总；完成失败不残留状态变化；编辑已完成日志替换快照而非新增；已关闭周期仍拒绝写入。

```ts
expect(noLogCompletion.status).toBe(400);
expect(workoutAfterRejectedCompletion.status).toBe("PLANNED");
expect(editedLogCount).toBe(1);
expect(energyAfterProfileWeightChange).toEqual(originalEnergy);
expect(backfilledLog.completedLocalDate).toBe("2026-09-27");
```

- [ ] 运行 `npx vitest run --project node server/tests/integration/workout-energy.test.ts server/tests/integration/workout-log.test.ts`，预期因完成校验/快照缺失而失败。
- [ ] 将日志校验、日志/sets 保存、completedAt、状态、估算快照放在同一事务。读取动作计划 restSeconds；估算使用实际 sets。训练创建的日期从 completedAt 与记录时区确定；确保该 NutritionDay 存在以固定时区。跨日补登记不使用 scheduledDate。已有日志编辑保留身体参数快照，首次估算记录 bodyWeightSource=PROFILE_AT_LOGGING。
- [ ] 显式更正 completedAt 才重新计算归属；单纯资料时区更改或刷新不移动旧归属。旧日志修正复用原 timezone；若显式改到已有日，使用该日固定 timezone，并测试边界归属一致。新日志先查按当前记录时区确定的候选日，再锁定该日；如固定时区会得出不同日期，返回400说明归属冲突，要求用户修正完成时间，不能静默移动。
- [ ] 所有快捷完成/补登记按钮：有合法已存日志可直接完成，没有则进入现有日志表单；力量不加时长；有氧/运动展示用户可确认的实际时长。展示“Estimated exercise calories”和 unsupported/partial 状态，别显示未知为0。档案体重修改不触发全量训练更新。
- [ ] 重跑测试、`npm run typecheck`；确认三种入口和既有锁定限制通过，提交 `feat: snapshot workout energy on valid completion`。

### Task 8: 每日读模型与准确日期归属

**Files:** 新增 shared nutrition/day.ts、server nutrition/day.ts、`shared/tests/domain/nutrition-day.test.ts`、`server/tests/integration/nutrition-day.test.ts`；扩展 nutrition route/serializers。

**Interfaces:** `summarizeNutritionDay(input: { entries: FoodEntry[]; target: TargetValues | null; exercise: DayEnergy }): { food: NutritionTotals; netKcal: number; remainingKcal: number | null }`；`NutritionDays.getDay(userId: string, date: LocalDate): Promise<NutritionDayDto>`；GET `/api/nutrition/day?date=`。无实体日返回revision0、不在GET创建目标或完成状态。

- [ ] 写失败测试：Food2000/Exercise300/Target1939→Net1700/Remaining239；空白未确认 recorded=false，确认空白 recorded=true；Net允许负数；不把计划或别人的训练计入；部分覆盖保留已知小计；无训练为0/COMPLETE，全部unsupported为0/UNAVAILABLE。

```ts
expect(summary.netKcal).toBe(1700);
expect(summary.remainingKcal).toBe(239);
expect(negative.netKcal).toBe(-300);
expect(emptyDay.recorded).toBe(false);
expect(partialDay.exercise.coverage).toBe("PARTIAL");
```

- [ ] 运行 `npx vitest run --project node shared/tests/domain/nutrition-day.test.ts server/tests/integration/nutrition-day.test.ts`，应因读模型缺失而失败。
- [ ] 从 FoodLog 快照求和，从 COMPLETED WorkoutLog 的已存 completedLocalDate 归属求和，从有效目标版本取目标。不要实时用用户新时区重新归类历史时间戳。日数据读取使用一个一致数据库读事务；不改 completedAt。PARTIAL/UNAVAILABLE 时 netKcal 是基于已估算小计，DTO明确覆盖状态，不能用于完整净目标评价。
- [ ] 加 Auckland午夜与DST、无ACTIVE周期、首次目标前/未来日期拒绝、旅行后查看旧日仍不变的集成断言。日期不经浏览器隐式解析；目标与training仅变化时completedAt保持。
- [ ] 重跑上述命令，通过后提交 `feat: build daily nutrition and energy summaries`。

### Task 9: 饮食日记页面与食品选择

**Files:** 新增 nutrition页面、四个组件、client/api/nutrition.ts、`client/tests/ui/nutrition.test.tsx`；修改 App/router、API contracts/client、ProfilePage（目标摘要入口）。

**Interfaces:** 导出既有 `request<T>` 供 nutrition API 模块复用；`getNutritionDay(date)`、`searchFoods(q,cursor?)`、`getFood(id)`、`addFoodEntry(input)`、`updateFoodEntry(id,input)`、`deleteFoodEntry(id,revision)`、`setNutritionDayCompletion(date,complete,revision)`。NutritionPage 消费 NutritionDayDto，不发明另一套计算公式。

- [ ] 写失败 UI 测试：四餐与四项导航；无记录文案；选择ea显示来源单个重量，1.5个可输入；非ea食品无ea选项；日期选择原样传YYYY-MM-DD；部分消耗不出现“目标达成”；超过目标文案用 exceeded 而非负remaining。

```ts
expect(screen.getByRole("link", { name: "Nutrition" })).toBeVisible();
expect(screen.getByText("Not recorded")).toBeVisible();
expect(screen.queryByText("Target achieved")).not.toBeInTheDocument(); // partial fixture
expect(addFoodEntry).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-09-27", unit: "ea", quantity: 1.5 }));
```

- [ ] 运行 `npx vitest run --project client client/tests/ui/nutrition.test.tsx`，应因页面/组件缺失而失败。
- [ ] 实现日期→四餐→搜索→份量预览→保存流程，搜索分页/空结果/失败可重试，输入取消不保存。预览复用 shared 份量函数，服务端返回值为最终权威值。请求使用每次新建意图固定的 clientRequestId，网络重试复用；保存中禁重复按钮。409刷新日数据并保留用户未保存输入，用户确认重试后使用新revision。
- [ ] 完整日食品增删改后展示未完成；确认空白日显示漏记提示再允许确认。Food/Exercise/Net/目标差额分别显示，宏量不因运动变化。负值文本保留，进度条视觉夹在0–100%。目标不可用时提供 Profile 入口。
- [ ] 添加训练明细链接和估算覆盖提示；桌面及移动端四导航可操作；营养页面路由只需要已登录和有效资料，不要求ACTIVE周期，不能被现有周期守卫误拦截。
- [ ] 重跑UI测试与 `npm run build --workspace @fitness/client`，通过后提交 `feat: add nutrition diary and food entry interface`。

### Task 10: 周期营养统计纯函数与加载器

**Files:** 新增 shared nutrition/summary.ts、server nutrition/summary.ts、`shared/tests/domain/nutrition-summary.test.ts`、`server/tests/integration/nutrition-summary.test.ts`；修改共享导出。

**Interfaces:** `buildNutritionSummary(days: NutritionDayDto[], window: { startDate: LocalDate; endDate: LocalDate }, generatedAt: string): NutritionSummary`；`loadCycleNutrition(tx, userId, window): Promise<NutritionDayDto[]>`。NutritionSummary 定义为：version="nutrition-summary-v1"、generatedAt、startDate/endDate、periodDays、completeFoodDays、targetDays、netComparableDays、averageFood: NutritionTotals|null、averageMacroGap: Omit<NutritionTotals,"kcal">|null、averageNetKcal:number|null、averageNetGapKcal:number|null、trendEligible:boolean、coverageGaps:LocalDate[]；比较由 `compareNutrition(current, previous|null)` 返回双方样本数及同口径平均差值或null。

- [ ] 写失败测试：周期范围按现有起止日闭区间，中途目标更改逐日减；仅完整日计全天摄入，未完整不是0；平均净值/净差仅在有目标且训练覆盖完整的完整日计算；完整但无目标可计摄入不能计目标差；0样本各均值null；2完整日trendEligible=false，3完整日true；覆盖不足时仍禁止净趋势结论。

```ts
expect(twoDaySummary.trendEligible).toBe(false);
expect(emptySummary.averageFood).toBeNull();
expect(changingTarget.averageNetGapKcal).toBe(50); // 两日净值均2000，目标1900和2000
expect(comparison.foodKcalDelta).toBe(0); // 上周期2天、当前7天，每天均2000
expect(delayedClose.periodDays).toBe(7); // 结束日后额外记录不收入
```

- [ ] 运行 `npx vitest run --project node shared/tests/domain/nutrition-summary.test.ts server/tests/integration/nutrition-summary.test.ts`，应因摘要缺失而失败。
- [ ] 实现明确的样本子集：averageFood基于完整日；macroGap基于完整且有目标日；net值/差基于完整、有目标、消耗COMPLETE日。trendEligible只控制饮食整周描述；AI另用netComparableDays≥3才讨论净目标趋势。compareNutrition 返回 `foodKcalDelta`、`netGapKcalDelta` 与双方对应样本数，任一侧无样本返回null，趋势样本不足仅描述记录。
- [ ] 加载器沿现有 cycle 实际 startDate/endDate，不使用界面日历Mon–Sun或关闭当天。生成范围内每天的读模型，包括未记录日；不写假目标。与上一实际周期浅比较，无上一周期时返回null。
- [ ] 重跑上述命令并检查差值单位/样本分母一致，通过后提交 `feat: summarize cycle nutrition with explicit coverage`。

### Task 11: 复盘快照、AI 解释和报告 UI

**Files:** 修改 reviews/service、AI review prompt/schemas/fake-client、ReviewPage、API contracts；更新 `server/tests/integration/cycle-review.test.ts`；新增 `client/tests/ui/nutrition-review.test.tsx`、`server/tests/integration/nutrition-review.test.ts`。

**Interfaces:** CycleReviewSnapshot.nutritionSummary保存任务10摘要和 comparison，objectiveSummary保留原训练量。`CycleReviewPromptInput` 增加 nutritionSummary 和 previousNutritionSummary；prompt版本改 `weekly-review.v2`。AI结果增加 `nutritionReview: { status: "INSUFFICIENT_DATA" | "AVAILABLE"; observations: string[]; suggestions: string[] }`，不接受target替换或食谱字段。

- [ ] 写失败测试：无完整日仍可生成训练复盘和next draft；少于3日只描述记录；无体重趋势不声称实际增减脂；fake-client返回符合新schema。用可暂停的假AI，在快照生成后修改当天饮食，再恢复AI，断言prompt、报告统计、持久化摘要仍引用同一generatedAt和数值。

```ts
expect(saved.nutritionSummary).toEqual(summarySentToAi);
expect(saved.objectiveSummary).toEqual(trainingVolumeBeforeNutrition);
expect(profileAfterReview).toEqual(profileBeforeReview);
expect(noFoodReview.nutritionReview.status).toBe("INSUFFICIENT_DATA");
```

- [ ] 运行 `npx vitest run --project node server/tests/integration/nutrition-review.test.ts server/tests/integration/cycle-review.test.ts`，应因缺营养快照和prompt输入而失败。
- [ ] 在短一致性读事务中冻结训练和营养摘要（PostgreSQL RepeatableRead 或等价的同一快照读取），先保存复盘输入，再事务外调用AI。AI失败沿用现有重试路径，同一review重试复用冻结输入；后续饮食编辑不修改已保存报告。并发请求沿用已有review唯一/状态机制，防止一个报告混入两个输入版本。
- [ ] prompt明确只解释给定统计，输出样本不足、覆盖缺口和可操作记录建议；不称低摄入为成功，不要求四项100%，不声称没有数据支持的身体变化。确定性的样本/状态由服务器决定，不能只靠提示词。更新fake-client与schema，next-draft仍按现有训练规则，不写NutritionTarget。
- [ ] Report UI 增加截至生成时记录、完整日/周期天数、均值/目标差和上周期样本数，null显示无有效样本。只展示现有AI结构的解释，日记在AI失败时仍正常使用。
- [ ] 运行上述node测试、`npx vitest run --project client client/tests/ui/nutrition-review.test.tsx` 与 `npm run typecheck`，通过后提交 `feat: include immutable nutrition context in cycle reviews`。

### Task 12: 完整流程回归与交付说明

**Files:** 新增 `tests/e2e/nutrition.spec.ts`；修改 `tests/e2e/backfill-and-close.spec.ts`、`tests/e2e/support/database.ts`（仅隔离fixtures）、README.md、数据说明；必要时修正前述实现的真实回归。

**Interfaces:** 端到端只使用公开UI/API和现有 fake auth/AI，不添加生产后门。测试食品为固定少量来源fixture，完整食品包导入另有任务5记录。

- [ ] 先写当前缺失行为的失败E2E：资料保存→无ACTIVE周期访问Nutrition→g/ea各记一餐→确认完整→编辑取消完整→完成力量和cardio→净值减少但目标/宏量不变→补登记落在昨天→修改体重不改昨天→关闭周期看到营养摘要。重复POST与409恢复沿任务6/9集成测试验证，E2E关注真实页面连通。
- [ ] 运行 `npx playwright test tests/e2e/nutrition.spec.ts tests/e2e/backfill-and-close.spec.ts`，仅在隔离DATABASE_URL下；若发现失败，先定位具体实现再改，不能降低断言规避。
- [ ] 验证迁移链在全新隔离数据库完成、种子和食品导入可重跑；README列出必需环境变量、导入命令、来源校验、公式版本、已知静态动作覆盖边界和开发库重建方法。不可把实际线上reset写成自动发布步骤。
- [ ] 执行最终必要门禁，逐项记录真实结果：`npm run typecheck`、`npm run typecheck:e2e`、`npm test`、`npm run build --workspace @fitness/client`、`npx prisma validate --schema prisma/schema.prisma`、上述两条E2E。全量测试若因环境跳过，单独列明而非标绿；不在完成门禁后反复追加无明确风险的测试。
- [ ] 人工检查移动端四项导航、食品搜索和份量弹窗的键盘/触屏可用性；确认无新力量时长字段、无旧Sex选项、净值未被裁剪、no-cycle可记录。
- [ ] 提交 `test: verify nutrition and workout energy flows`，附数据来源与运行结果。遵照所选执行方式完成代码审阅，修复阻断问题。向用户交付改动摘要、测试结果及剩余限制；不自动合并、发布或清空数据库。

## 自审与设计覆盖

| 设计章节 | 实施任务 |
| --- | --- |
| 1 产品范围/2仓库接入 | 1、4、7、9 |
| 3 界面 | 9、11、12 |
| 4 数据来源/清洗/ea | 5、6 |
| 5 固定目标/历史生效 | 2、4 |
| 6 力量/7其他训练 | 3、7 |
| 8 汇总/时区/完整性 | 2、4、6、8 |
| 9 模型/10接口 | 1、5、6、7、8 |
| 11 周复盘 | 10、11 |
| 12 迁移/13交付验收 | 1、12 |
| 14 已确认参数/15来源 | 2、3、5；引用随设计稿保留 |

本计划自审重点：净摄入为派生值；变量和DTO命名一致；五类Review Focus均有归属测试；数据导入、AI调用均在写事务外；保留现有训练量和周期修改限制。具体食物release/checksum、MET活动映射与导入条数是任务3/5执行时必须核实并提交的来源产物，当前不冒充已下载、已核实或已执行。

## 交接

计划待用户审阅并选择执行方式：Native（同一代理连续实施，末尾独立审阅）或 Subagent-driven（分任务实施与审阅）。本功能的schema、快照、日期和事务规则紧密关联，推荐Native，减少跨任务上下文重复。确认执行方式后才开始产品实现；本计划的文件准备不代表已经创建产品PR、迁移数据库或发布。
