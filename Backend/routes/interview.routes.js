import express from "express";
import isAuth from "../middlewares/isAuth.js";
// BUG FIX: `upload` was used below but never imported.
import { upload } from "../middlewares/multer.js";
import {
    analyzeResume,
    emailReport,
    finishInterview,
    generateQuestion,
    getInterviewReport,
    getLeaderboard,
    getMyInterviews,
    getWeakTopics,
    parseJD,
    submitAnswer,
    submitFollowUp,
} from "../controllers/interview.controller.js";

const interViewRouter = express.Router();

interViewRouter.post(
    "/resume",
    isAuth,
    upload.single("resume"),
    analyzeResume
);

// NEW (Feature: Custom Company JD Upload)
interViewRouter.post("/parse-jd", isAuth, upload.single("jd"), parseJD);

interViewRouter.post("/generate-questions", isAuth, generateQuestion);

interViewRouter.post("/submit-answer", isAuth, submitAnswer);

// NEW (Feature: AI Follow-up Questions)
interViewRouter.post("/submit-followup", isAuth, submitFollowUp);

interViewRouter.post("/finish", isAuth, finishInterview);

interViewRouter.get("/get-interview", isAuth, getMyInterviews);

interViewRouter.get("/report/:id", isAuth, getInterviewReport);

// NEW (Feature: Weak-Topic Tracker)
interViewRouter.get("/weak-topics", isAuth, getWeakTopics);

// NEW (Feature: Email PDF Report)
interViewRouter.post("/email-report", isAuth, emailReport);

// NEW (Feature: Leaderboard / Peer Benchmarking)
interViewRouter.get("/leaderboard", isAuth, getLeaderboard);

export default interViewRouter;