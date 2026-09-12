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

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ai-interview-platform-woad-delta.vercel.app",
];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/+$/, ""));
}

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const cleanOrigin = origin.replace(/\/+$/, "");
            if (
                allowedOrigins.includes(cleanOrigin) ||
                cleanOrigin.endsWith(".vercel.app") ||
                process.env.NODE_ENV !== "production"
            ) {
                return callback(null, cleanOrigin);
            }
            return callback(null, cleanOrigin);
        },
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
        console.log("CORS allowed origins:", allowedOrigins);
    });
});