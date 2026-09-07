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

// BUG FIX (found during deployment): CORS requires an EXACT string
// match between the "Access-Control-Allow-Origin" header and the
// browser's actual Origin - even a single trailing "/" difference
// causes every request to be blocked (this happened once before with a
// hardcoded "localhost:5173/", and now again because FRONTEND_URL was
// set on Render with a trailing slash, e.g. "...vercel.app/" instead of
// "...vercel.app"). Rather than relying on every future deployment to
// get this exactly right, strip any trailing slash from FRONTEND_URL
// here in code - so it works correctly regardless of how the env var is
// set.
const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

app.use(
    cors({
        origin: frontendUrl,
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
        console.log(`CORS allowed origin: ${frontendUrl}`);
    });
});