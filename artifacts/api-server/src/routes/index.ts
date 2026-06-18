import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import mangaRouter from "./manga";
import bookmarksRouter from "./bookmarks";
import historyRouter from "./history";
import reactionsRouter from "./reactions";
import favouritesRouter from "./favourites";
import profileRouter from "./profile";
import flamecomicsRouter from "./flamecomics";
import ratingsRouter from "./ratings";
import commentsRouter from "./comments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(mangaRouter);
router.use(bookmarksRouter);
router.use(historyRouter);
router.use(reactionsRouter);
router.use(favouritesRouter);
router.use(profileRouter);
router.use(flamecomicsRouter);
router.use(ratingsRouter);
router.use(commentsRouter);

export default router;
