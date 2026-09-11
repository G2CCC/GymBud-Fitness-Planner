import { Router } from "express";
import { planRouter } from "./ai/plans/route";
import { cycleRouter } from "./cycles/route";
import { exerciseRouter } from "./exercises/route";
import { workoutRouter } from "./workouts/route";

export const apiRouter = Router();
apiRouter.use("/ai/plans", planRouter);
apiRouter.use("/cycles", cycleRouter);
apiRouter.use("/exercises", exerciseRouter);
apiRouter.use("/workouts", workoutRouter);
