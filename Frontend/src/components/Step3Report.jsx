import { useState } from "react";
import { FaArrowLeft, FaDownload, FaEnvelope } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
// BUG FIX: AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area were all
// used below but never imported from recharts (only ResponsiveContainer
// was imported).
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// NEW (Feature: Email PDF Report)
import axios from "axios";
import { ServerUrl } from "../utils/constants";

const Step3Report = ({ report }) => {
  // BUG FIX (critical structural bug): in the original file the component
  // function closed its curly brace right after this early-return guard.
  // Everything below — useNavigate(), the destructuring, the PDF logic,
  // and the entire `return (...)` JSX — was accidentally written OUTSIDE
  // the component function, at module scope. That's not valid React and
  // wouldn't compile. Everything now correctly lives inside one function
  // body, with the guard clause simply returning early instead of ending
  // the function.
  const navigate = useNavigate();

  // NEW (Feature: Email PDF Report)
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");

  if (!report) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <p className="text-sm" style={{ color: "#6B7280" }}>
          No report data available.
        </p>
      </div>
    );
  }

  const {
    finalScore = 0,
    confidence = 0,
    communication = 0,
    // BUG FIX: typo `correctionss` -> `correctness` (matches the API
    // response field name from the backend).
    correctness = 0,
    questionWinScore = [],
    // NEW (Feature: Coding Round Mode)
    mode = "",
  } = report;

  const isCodingRound = mode === "Coding";

  const questionScoreData = questionWinScore.map((q, index) => ({
    name: `Q${index + 1}`,
    score: q.score || 0,
  }));

  // BUG FIX: original referenced `Communication` and `Correctness`
  // (capitalized) which were never declared anywhere — only the
  // lowercase destructured variables exist. This would throw
  // "Communication is not defined".
  // NEW: for coding rounds, the backend re-purposes the same 3 numeric
  // fields as (Efficiency, Code Quality, Correctness) instead of
  // (Confidence, Communication, Correctness) - relabel here to match
  // what the AI was actually asked to evaluate.
  const skills = isCodingRound
    ? [
        { label: "Efficiency", value: confidence },
        { label: "Code Quality", value: communication },
        { label: "Correctness", value: correctness },
      ]
    : [
        { label: "Confidence", value: confidence },
        { label: "Communication", value: communication },
        { label: "Correctness", value: correctness },
      ];

  // NEW: Filler-word & Pace Analysis summary (aggregated across questions)
  const totalFillerWords = questionWinScore.reduce(
    (sum, q) => sum + (q.fillerWordCount || 0),
    0
  );
  const avgFillerWords = questionWinScore.length
    ? (totalFillerWords / questionWinScore.length).toFixed(1)
    : 0;
  const paceCounts = questionWinScore.reduce((acc, q) => {
    const p = q.pace || "unknown";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const dominantPace =
    Object.entries(paceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";

  const paceStyle = {
    "too slow": { color: "var(--gold)", bg: "rgba(232,163,61,0.15)", label: "Too Slow" },
    ideal: { color: "var(--green)", bg: "rgba(30,138,95,0.12)", label: "Ideal Pace" },
    "too fast": { color: "var(--red)", bg: "rgba(214,69,69,0.12)", label: "Too Fast" },
    unknown: { color: "#6B7280", bg: "var(--surface-muted)", label: "Not Enough Data" },
  };

  // NEW (Feature: Webcam Confidence Detection) — aggregate across
  // questions where the candidate allowed camera access.
  const eyeContactValues = questionWinScore
    .map((q) => q.eyeContactPercentage)
    .filter((v) => v !== null && v !== undefined);
  const avgEyeContact = eyeContactValues.length
    ? Math.round(eyeContactValues.reduce((a, b) => a + b, 0) / eyeContactValues.length)
    : null;

  const expressionCounts = questionWinScore.reduce((acc, q) => {
    if (q.dominantExpression) {
      acc[q.dominantExpression] = (acc[q.dominantExpression] || 0) + 1;
    }
    return acc;
  }, {});
  const dominantExpressionOverall =
    Object.entries(expressionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const EXPRESSION_LABELS = {
    happy: "Positive & Engaged",
    neutral: "Calm & Composed",
    surprised: "Alert",
    fearful: "A Little Nervous",
    sad: "Low Energy",
    angry: "Tense",
    disgusted: "Uncomfortable",
  };

  // NOTE: declared without an initial value (instead of `= ""`) because
  // every branch below assigns one before use — eslint's
  // no-useless-assignment rule correctly points out that an initial ""
  // would just get thrown away immediately.
  let performanceText;
  let shortTagline;

  if (finalScore >= 8) {
    performanceText = "Ready for job opportunities.";
    shortTagline = "Excellent clarity and structured response.";
  } else if (finalScore >= 5) {
    performanceText = "Needs minor improvement before interviews.";
    shortTagline = "Good foundation, refine articulation.";
  } else {
    performanceText = "Significant improvement required.";
    shortTagline = "Work on clarity and confidence.";
  }

  const score = finalScore;
  const percentage = (score / 10) * 100;

  // NEW (Feature: Email PDF Report) — refactored the PDF-building logic
  // out of downloadPDF() into its own function that just returns the
  // jsPDF `doc` object. Both "Download PDF" and "Email Report" need the
  // exact same PDF, so building it once and letting each caller decide
  // what to do with it (save locally vs. convert to base64 and email)
  // avoids duplicating this whole block.
  const buildPDFDocument = () => {
    // BUG FIX: unit code "mn" isn't valid for jsPDF, valid units are
    // "pt" | "mm" | "cm" | "in" etc. -> "mm"
    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let currentY = 26;

    // ======== TITLE ========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(34, 197, 94);
    // BUG FIX: "Inrerview" typo -> "Interview"
    doc.text("AI Interview Performance Report", pageWidth / 2, currentY, {
      align: "center",
    });

    currentY += 5;
    doc.setDrawColor(34, 197, 94);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
    currentY += 15;

    // ======== FINAL SCORE BOX ========
    // BUG FIX: setFillColor(240, 257, 244) - 257 isn't a valid RGB
    // channel value (max is 255). Corrected to a light green (240,253,244).
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, "F");

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Final Score: ${finalScore}/10`, pageWidth / 2, currentY + 12, {
      align: "center",
    });

    currentY += 30;

    // ======== SKILL BOX ========
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, currentY, contentWidth, 30, 4, 4, "F");

    doc.setFontSize(12);
    doc.text(`${skills[0].label}: ${confidence}`, margin + 10, currentY + 10);
    doc.text(`${skills[1].label}: ${communication}`, margin + 10, currentY + 18);
    doc.text(`${skills[2].label}: ${correctness}`, margin + 10, currentY + 26);

    currentY += 45;

    // ======== ADVICE BOX ========
    // BUG FIX: `let advice = "",` had a trailing comma with nothing after
    // it — invalid syntax (a comma-separated declaration needs another
    // variable name). Also, advice text was always empty in every branch.
    let advice;

    if (finalScore >= 8) {
      advice =
        "Great job! Keep practicing to maintain this level of confidence and clarity in real interviews.";
    } else if (finalScore >= 5) {
      advice =
        "You're on the right track. Focus on structuring your answers and speaking with more confidence.";
    } else {
      advice =
        "Keep practicing regularly. Work on clarity, structure, and confidence in your responses.";
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220);
    // BUG FIX: `doc.roundReact(...)` typo -> `doc.roundedRect(...)`
    doc.roundedRect(margin, currentY, contentWidth, 30, 4, 4, "S");
    doc.setFont("helvetica", "bold");
    doc.text("Professional Advice", margin + 10, currentY + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const splitAdvice = doc.splitTextToSize(advice, contentWidth - 20);
    doc.text(splitAdvice, margin + 10, currentY + 20);

    currentY += 50;

    // ======== QUESTION TABLE ========
    // BUG FIX: `head: [[]]` had no actual header labels, and all the
    // style objects were empty. Filled in real headers + basic styling.
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["#", "Question", "Score", "Feedback"]],
      body: questionWinScore.map((q, i) => [
        `${i + 1}`,
        q.question,
        `${q.score}/10`,
        q.feedback,
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [59, 79, 224], textColor: 255 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 18 } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    return doc;
  };

  const downloadPDF = () => {
    const doc = buildPDFDocument();
    doc.save("AI_Interview_Report.pdf");
  };

  // NEW (Feature: Email PDF Report)
  const emailPDFReport = async () => {
    if (isEmailing) return;
    setIsEmailing(true);
    setEmailStatus("");

    try {
      const doc = buildPDFDocument();
      // jsPDF's datauristring output looks like
      // "data:application/pdf;filename=generated.pdf;base64,JVBERi0x..."
      // - strip everything up to the actual base64 payload.
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.split("base64,")[1];

      const result = await axios.post(
        ServerUrl + "/api/interview/email-report",
        { pdfBase64: base64Data },
        { withCredentials: true }
      );

      setEmailStatus(result.data.message || "Report emailed successfully!");
    } catch (error) {
      console.log(error);
      setEmailStatus(
        error.response?.data?.message || "Failed to email report. Please try again."
      );
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* BUG FIX: two onClick handlers were on this single button
                (the second silently overrode the first, dead code). Kept
                one: go back to interview history. */}
            <button
              onClick={() => navigate("/history")}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white border"
              style={{ borderColor: "var(--border)" }}
            >
              <FaArrowLeft style={{ color: "var(--ink)" }} />
            </button>

            <div>
              <h1 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
                Interview Analytics Dashboard
              </h1>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                AI-powered performance insights
              </p>
            </div>
          </div>

          {/* BUG FIX: the Download PDF button had no onClick handler at
              all — clicking it did nothing. */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: "var(--indigo)" }}
              >
                <FaDownload size={13} />
                Download PDF
              </button>

              {/* NEW (Feature: Email PDF Report) */}
              <button
                onClick={emailPDFReport}
                disabled={isEmailing}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border bg-white disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <FaEnvelope size={13} />
                {isEmailing ? "Sending..." : "Email Report"}
              </button>
            </div>
            {emailStatus && (
              <p className="text-xs" style={{ color: "#6B7280" }}>
                {emailStatus}
              </p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border p-6 flex flex-col items-center text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-4 self-start" style={{ color: "var(--ink)" }}>
              Overall Performance
            </h3>

            <div className="w-36 h-36 mb-4">
              <CircularProgressbar
                value={percentage}
                text={`${score}/10`}
                styles={buildStyles({
                  textSize: "16px",
                  pathColor: "var(--indigo)",
                  textColor: "var(--ink)",
                  trailColor: "var(--border)",
                })}
              />
            </div>

            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                {performanceText}
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                {shortTagline}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
              Skill Evaluation
            </h3>

            <div className="flex flex-col gap-4">
              {skills.map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: "var(--ink)" }}>{s.label}</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--indigo)" }}>
                      {s.value}/10
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${s.value * 10}%`, backgroundColor: "var(--indigo)" }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* NEW: Filler-word & Pace Analysis summary card - only relevant
            for spoken interviews, not coding rounds. */}
        {!isCodingRound && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl border p-6 mb-6 grid sm:grid-cols-2 gap-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Speaking Habits
            </h3>
            <div className="flex items-center gap-4">
              <div>
                <p className="font-mono text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                  {avgFillerWords}
                </p>
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  Avg filler words / answer
                </p>
              </div>
              <div
                className="h-10 w-px"
                style={{ backgroundColor: "var(--border)" }}
              ></div>
              <div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: paceStyle[dominantPace].bg,
                    color: paceStyle[dominantPace].color,
                  }}
                >
                  {paceStyle[dominantPace].label}
                </span>
                <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                  Overall speaking pace
                </p>
              </div>
            </div>
          </div>
          <div className="text-sm flex items-center" style={{ color: "#6B7280" }}>
            {totalFillerWords === 0 ? (
              <p>
                No filler words detected — clean, confident delivery. Keep it up!
              </p>
            ) : (
              <p>
                Words like "um", "like", and "actually" can make answers sound
                less confident. Try pausing silently instead of filling gaps
                with these words.
              </p>
            )}
          </div>
        </motion.div>
        )}

        {/* NEW (Feature: Webcam Confidence Detection) - only shows if the
            candidate actually granted camera access during at least one
            question, otherwise there's nothing meaningful to display. */}
        {!isCodingRound && avgEyeContact !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className="bg-white rounded-2xl border p-6 mb-6 grid sm:grid-cols-2 gap-6"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
                Confidence Detection
              </h3>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-mono text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                    {avgEyeContact}%
                  </p>
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    Avg camera engagement
                  </p>
                </div>
                <div className="h-10 w-px" style={{ backgroundColor: "var(--border)" }}></div>
                <div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "rgba(59,79,224,0.1)", color: "var(--indigo)" }}
                  >
                    {dominantExpressionOverall
                      ? EXPRESSION_LABELS[dominantExpressionOverall] || dominantExpressionOverall
                      : "Not enough data"}
                  </span>
                  <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                    Overall expression
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm flex items-center" style={{ color: "#6B7280" }}>
              {avgEyeContact >= 70 ? (
                <p>
                  You stayed engaged and facing the camera through most of
                  the interview — that reads as confident on a video call.
                </p>
              ) : (
                <p>
                  Your camera engagement was lower than ideal. Try keeping
                  your face centered and looking at the camera (not the
                  screen text) while answering.
                </p>
              )}
            </div>
          </motion.div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
              Performance Trend
            </h3>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={questionScoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  {/* BUG FIX: dataKey={name} referenced an undefined
                      variable `name` — should be the string "name". */}
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis domain={[0, 10]} stroke="#9CA3AF" fontSize={12} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--indigo)"
                    fill="rgba(59,79,224,0.15)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
              Question Breakdown
            </h3>
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto scroll-thin pr-1">
              {questionWinScore.map((q, i) => (
                <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--indigo)" }}>
                        Question {i + 1}
                      </p>
                      <p className="text-sm" style={{ color: "var(--ink)" }}>
                        {q.question || "Question not available"}
                      </p>
                    </div>
                    <div
                      className="text-xs font-mono font-semibold px-2 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: "rgba(59,79,224,0.1)", color: "var(--indigo)" }}
                    >
                      {/* BUG FIX: stray semicolon inside JSX text `{q.score ?? 0}/10;` */}
                      {q.score ?? 0}/10
                    </div>
                  </div>

                  <div className="mt-2">
                    <p className="text-xs font-medium mb-0.5" style={{ color: "#6B7280" }}>
                      AI Feedback
                    </p>
                    <p className="text-xs" style={{ color: "var(--ink)" }}>
                      {q.feedback && q.feedback.trim() !== ""
                        ? q.feedback
                        : "No feedback available for this question."}
                    </p>
                  </div>

                  {/* NEW (Feature: Coding Round Mode): show the actual
                      code the candidate submitted, so the report is
                      useful for revision later. */}
                  {isCodingRound && q.answer && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>
                        Submitted Code
                        {q.codeLanguage ? ` (${q.codeLanguage})` : ""}
                      </p>
                      <pre
                        className="text-xs font-mono p-2 rounded-lg overflow-x-auto"
                        style={{ backgroundColor: "#151B2B", color: "#E4E6EE" }}
                      >
                        {q.answer}
                      </pre>
                    </div>
                  )}

                  {/* NEW (Feature: AI Follow-up Questions) — only exists
                      when the AI decided this answer was weak enough to
                      probe deeper. */}
                  {q.followUp?.question && (
                    <div
                      className="mt-3 rounded-lg p-3 border"
                      style={{ borderColor: "rgba(59,79,224,0.2)", backgroundColor: "rgba(59,79,224,0.05)" }}
                    >
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--indigo)" }}>
                        AI Follow-up: {q.followUp.question}
                      </p>
                      {q.followUp.answer ? (
                        <>
                          <p className="text-xs mb-1" style={{ color: "var(--ink)" }}>
                            <span className="font-medium">Your answer: </span>
                            {q.followUp.answer}
                          </p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            {q.followUp.feedback}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs italic" style={{ color: "#9CA3AF" }}>
                          Not answered
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Step3Report;