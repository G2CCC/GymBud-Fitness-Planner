import { Router } from "express";
import { cycleRouter } from "./cycles/route";
import { exerciseRouter } from "./exercises/route";

export const apiRouter = Router();
apiRouter.use("/cycles", cycleRouter);
apiRouter.use("/exercises", exerciseRouter);
