import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import { settingsRouter } from "./settings";
import usersRouter from "./users";
import storageRouter from "./storage";
import leadSourcesRouter from "./lead-sources";
import leadsRouter from "./leads";
import metricsRouter from "./metrics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(salesRouter);
router.use(settingsRouter);
router.use(usersRouter);
router.use(storageRouter);
router.use(leadSourcesRouter);
router.use(leadsRouter);
router.use(metricsRouter);

export default router;
