import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema({
    question: String,
    difficulty: String,
    timeLimit: Number,
    answer: String,
    feedback: String,
    score: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    correctness: { type: Number, default: 0 },
    // NEW (Feature: Filler-word & Pace Analysis)
    fillerWordCount: { type: Number, default: 0 },
    pace: {
        type: String,
        enum: ["too slow", "ideal", "too fast", "unknown"],
        default: "unknown",
    },
    // NEW (Feature: Coding Round Mode) — only populated when the
    // interview's mode is "Coding". Which programming language the
    // candidate wrote their submission in.
    codeLanguage: { type: String },
    // NEW (Feature: Weak-Topic Tracker) — a short subject tag the AI
    // assigns when generating the question (e.g. "Arrays", "DBMS",
    // "System Design", "Communication Skills"). Used to aggregate scores
    // by topic across all of a user's past interviews.
    topic: { type: String, default: "General" },
    // NEW (Feature: AI Follow-up Questions) — when the candidate's answer
    // is weak, the AI generates ONE targeted follow-up question to probe
    // deeper (like a real interviewer would), instead of moving straight
    // on. `question` is set as soon as the AI generates it; `answer`,
    // `feedback`, and `score` fill in once the candidate responds.
    followUp: {
        question: { type: String },
        answer: { type: String },
        feedback: { type: String },
        score: { type: Number },
    },
    // NEW (Feature: Webcam Confidence Detection) — computed client-side
    // via face-api.js during the question window, sent along with the
    // answer submission (same pattern as fillerWordCount/pace). null for
    // coding rounds and for candidates who denied camera permission.
    eyeContactPercentage: { type: Number, default: null },
    dominantExpression: { type: String, default: null },
});

// BUG FIX (big one): originally role, experience, mode, resumeText,
// questions, finalScore, and status were all nested INSIDE the `userId`
// field's definition object. That means they were never actual top-level
// fields on the Interview document — Mongoose would have silently ignored
// most of them. They all needed to be siblings of `userId`, not children.
const interviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: String,
            required: true,
        },
        experience: {
            type: String,
            required: true,
        },
        mode: {
            type: String,
            // NEW: "Coding" added for the Coding Round Mode feature.
            enum: ["HR", "Technical", "Coding"],
            required: true,
        },
        resumeText: {
            type: String,
        },
        // NEW (Feature: Custom Company JD Upload) — optional, only set
        // when the candidate pasted/uploaded a target job description.
        jdText: {
            type: String,
        },
        questions: [questionsSchema],
        finalScore: { type: Number, default: 0 },
        // BUG FIX: enum values were lowercase ("incompleted") but the
        // default was capitalized ("Incompleted") - mismatch would fail
        // schema validation. Normalized both to lowercase.
        status: {
            type: String,
            enum: ["incomplete", "completed"],
            default: "incomplete",
        },
    },
    { timestamps: true }
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;