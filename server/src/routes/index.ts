import { Router } from "express";
import { cycleRouter } from "./cycles/route";
import { exerciseRouter } from "./exercises/route";
import { workoutRouter } from "./workouts/route";

export const apiRouter = Router();
apiRouter.use("/cycles", cycleRouter);
apiRouter.use("/exercises", exerciseRouter);
apiRouter.use("/workouts", workoutRouter);
