import { Router } from "express";
import { cycleRouter } from "./cycles/route";

export const apiRouter = Router();
apiRouter.use("/cycles", cycleRouter);
