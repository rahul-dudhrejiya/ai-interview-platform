import express from "express";
import dotenv from "dotenv";
dotenv.config();

import connectDb from "./config/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import interViewRouter from "./routes/interview.routes.js";
import paymentRouter from "./routes/payment.routes.js";

const app = express();

// NEW (deployment): hardcoding "http://localhost:5173" here meant the
// deployed frontend (a different domain, e.g. your-app.vercel.app)
// would be blocked by CORS in production. FRONTEND_URL is read from an
// env var so the same code works in both places — set it to
// "http://localhost:5173" locally and to your real Vercel URL in
// Render's environment variables.
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/interview", interViewRouter);
app.use("/api/payment", paymentRouter);

const PORT = process.env.PORT || 8000;

process.on("unhandledRejection", (reason) => {
    console.error("🔴 Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("🔴 Uncaught Exception:", error);
});

const errorHandler = (err, req, res, next) => {
    console.error("🔴 Express error handler caught:", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: "Internal server error." });
};

connectDb().then(() => {
    app.use(errorHandler);

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});