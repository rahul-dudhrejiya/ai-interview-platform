import nodemailer from "nodemailer";

// BUG FIX (found during testing): the transporter used to be created at
// module-TOP-LEVEL, immediately when this file was first imported:
//
//   const transporter = nodemailer.createTransport({ host: process.env.EMAIL_HOST, ... });
//
// In ES modules, ALL of a file's `import` statements are fully evaluated
// BEFORE that file's own top-level code runs - regardless of where
// `dotenv.config()` appears textually in index.js. Since this service
// gets imported (transitively, via the interview routes) before
// index.js's own `dotenv.config()` line executes, `process.env.EMAIL_HOST`
// etc. were all still `undefined` at the moment createTransport() ran.
// With no host, Nodemailer fell back to trying to connect to
// 127.0.0.1:587 - hence "ECONNREFUSED 127.0.0.1:587".
//
// Fix: build the transporter LAZILY, inside a function that only runs
// when someone actually sends an email (well after the server has
// finished starting up and .env has definitely been loaded), and cache
// it after the first call so we don't reconnect every time.
let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: Number(process.env.EMAIL_PORT) === 465, // true for port 465, false for 587/others
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return transporter;
};

export const sendReportEmail = async ({ to, name, pdfBuffer }) => {
    await getTransporter().sendMail({
        from: `"InterviewIQ.AI" <${process.env.EMAIL_USER}>`,
        to,
        subject: "Your AI Interview Performance Report",
        text: `Hi ${name || "there"},\n\nYour interview performance report is attached as a PDF.\n\nKeep practicing!\n- InterviewIQ.AI`,
        html: `
            <div style="font-family: sans-serif; color: #151B2B;">
                <h2>Your AI Interview Report</h2>
                <p>Hi ${name || "there"},</p>
                <p>Your interview performance report is attached as a PDF. Keep practicing to improve your score!</p>
                <p style="color: #6B7280; font-size: 13px;">— InterviewIQ.AI</p>
            </div>
        `,
        attachments: [
            {
                filename: "AI_Interview_Report.pdf",
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
};