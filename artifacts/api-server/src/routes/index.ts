import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import { settingsRouter } from "./settings";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(salesRouter);
router.use(settingsRouter);
router.use(usersRouter);

export default router;
