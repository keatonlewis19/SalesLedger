import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import { settingsRouter } from "./settings";
import usersRouter from "./users";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(salesRouter);
router.use(settingsRouter);
router.use(usersRouter);
router.use(storageRouter);

export default router;
