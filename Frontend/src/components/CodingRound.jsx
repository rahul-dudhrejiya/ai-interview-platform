import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "motion/react";
import axios from "axios";
import { ServerUrl } from "../utils/constants";
import Timer from "./Timer";
import { BsArrowRight } from "react-icons/bs";

// Starter boilerplate per language so the editor isn't a blank void when
// the candidate switches languages.
const STARTER_CODE = {
  javascript: "// Write your solution here\n\nfunction solve() {\n  \n}\n",
  python: "# Write your solution here\n\ndef solve():\n    pass\n",
  java: "// Write your solution here\n\nclass Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n",
  cpp: "// Write your solution here\n\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
};

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

const CodingRound = ({ interviewData, onFinish }) => {
  const { interviewId, questions } = interviewData;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(STARTER_CODE.javascript);
  const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimit || 300);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // NEW: visible error state, same pattern as the spoken-interview flow.
  const [submitError, setSubmitError] = useState("");

  const currentQuestion = questions[currentIndex];

  // Reset the editor + timer whenever the candidate moves to a new problem.
  useEffect(() => {
    // BUG FIX: three consecutive synchronous setState calls directly in
    // the effect body - a genuine react-hooks/set-state-in-effect
    // violation (unlike the setInterval-based timer below, these run
    // immediately when the effect fires, not deferred). Wrapped with a
    // block disable since it's the same rule across all three lines,
    // instead of repeating eslint-disable-next-line three times.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCode(STARTER_CODE[language] || "");
    setTimeLeft(currentQuestion?.timeLimit || 300);
    setFeedback("");
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Countdown timer - same pattern as the voice interview flow.
  useEffect(() => {
    if (!currentQuestion || feedback) return;

    // NOTE: no set-state-in-effect disable needed here - the setState
    // call is inside the setInterval callback (deferred/async), not
    // synchronous in the effect body, so ESLint correctly doesn't flag it.
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // BUG FIX: `currentQuestion` is read here (`if (!currentQuestion...`)
    // but was missing from the dependency array. Added it - since it's
    // derived from `questions[currentIndex]`, it only changes exactly
    // when `currentIndex` already changes, so this adds no extra re-runs.
  }, [currentIndex, feedback, currentQuestion]);

  const handleLanguageChange = (newLang) => {
    // Only reset to starter code if the editor still has the default
    // boilerplate for the old language (don't nuke the candidate's work
    // if they've actually started typing).
    const isUntouched = code === STARTER_CODE[language];
    setLanguage(newLang);
    if (isUntouched) {
      setCode(STARTER_CODE[newLang] || "");
    }
  };

  const submitCode = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // NEW: timeout so a hung AI code-review call fails visibly instead
      // of leaving "Reviewing your code..." stuck forever (same root
      // cause found and fixed in the spoken-interview flow: the backend
      // OpenRouter call had no timeout at all).
      const result = await axios.post(
        ServerUrl + "/api/interview/submit-answer",
        {
          interviewId,
          questionIndex: currentIndex,
          answer: code,
          timeTaken: currentQuestion.timeLimit - timeLeft,
          codeLanguage: language,
        },
        { withCredentials: true, timeout: 40000 }
      );

      setSubmitError("");
      setFeedback(result.data.feedback);
      setIsSubmitting(false);
    } catch (error) {
      console.log(error);
      setSubmitError(
        error.code === "ECONNABORTED"
          ? "The AI took too long to review your code. Please try submitting again."
          : error.response?.data?.message || "Something went wrong. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  // Auto-submit whatever is in the editor when time runs out, same
  // safety-net behaviour as the voice interview flow.
  useEffect(() => {
    if (!currentQuestion) return;
    if (timeLeft === 0 && !isSubmitting && !feedback) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      submitCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const finishRound = async () => {
    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/finish",
        { interviewId },
        { withCredentials: true }
      );
      onFinish(result.data);
    } catch (error) {
      console.log(error);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      finishRound();
      return;
    }
    // BUG FIX (same root cause found in Step2Interview.jsx): if the
    // previous problem was auto-submitted because its timer hit 0,
    // `timeLeft` stayed at 0 until the separate currentIndex-triggered
    // effect reset it - leaving a brief window where the new problem
    // was visible with a stale 0 timer, which the auto-submit-on-timeout
    // effect could catch and instantly submit an empty solution for a
    // problem the candidate hadn't even started. Resetting timeLeft
    // here, in the same update as currentIndex, closes that gap.
    setIsSubmitting(false);
    setSubmitError("");
    const nextQuestion = questions[currentIndex + 1];
    setTimeLeft(nextQuestion?.timeLimit || 300);
    setCurrentIndex(currentIndex + 1);
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
              Coding Round
              {/* NEW (Feature: Custom Company JD Upload) */}
              {interviewData.isJDBased && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(232,163,61,0.15)", color: "var(--gold)" }}
                >
                  JD-Tailored
                </span>
              )}
            </h2>
            <p className="text-xs font-mono" style={{ color: "var(--indigo)" }}>
              Problem {currentIndex + 1} of {questions.length} ·{" "}
              {currentQuestion?.difficulty?.toUpperCase()}
            </p>
          </div>
          <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Problem statement panel */}
          <div
            className="bg-white rounded-2xl border p-5 max-h-[70vh] overflow-y-auto scroll-thin"
            style={{ borderColor: "var(--border)" }}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B7280" }}>
              Problem Statement
            </h3>
            <pre
              className="text-sm whitespace-pre-wrap font-body"
              style={{ color: "var(--ink)" }}
            >
              {currentQuestion?.question}
            </pre>

            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl border p-4"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--indigo)" }}>
                  AI Code Review
                </h4>
                <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>
                  {feedback}
                </p>
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3"
                  style={{ backgroundColor: "var(--emphasis)" }}
                >
                  {currentIndex + 1 >= questions.length ? "Finish Round" : "Next Problem"}{" "}
                  <BsArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </div>

          {/* Code editor panel */}
          <div
            className="bg-white rounded-2xl border overflow-hidden flex flex-col"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={!!feedback}
                className="text-sm font-mono font-medium bg-white outline-none"
                style={{ color: "var(--ink)" }}
              >
                {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ height: "420px" }}>
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  readOnly: !!feedback || isSubmitting,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>

            {!feedback && (
              <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
                {submitError && (
                  <div
                    className="text-xs rounded-lg px-3 py-2 mb-3"
                    style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
                  >
                    {submitError}
                  </div>
                )}
                <motion.button
                  onClick={submitCode}
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.98 }}
                  className="w-full text-white font-semibold rounded-xl py-3 disabled:opacity-50"
                  style={{ backgroundColor: "var(--indigo)" }}
                >
                  {isSubmitting ? "Reviewing your code..." : "Submit Solution"}
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodingRound;