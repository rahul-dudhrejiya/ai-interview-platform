import { useEffect, useRef, useState } from "react";
// BUG FIX: import paths were missing a slash: "..assets/..." resolves to
// a nonexistent path. Correct relative path is "../assets/...".
import maleVideo from "../assets/videos/male-ai.mp4";
import femaleVideo from "../assets/videos/female-ai.mp4";
import Timer from "./Timer";
import { motion } from "motion/react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import axios from "axios";
// BUG FIX: import path was '.../App' (invalid) -> '../App'
import { ServerUrl } from "../App";
import { BsArrowRight } from "react-icons/bs";
// NEW (Feature: Webcam Confidence Detection)
import WebcamMonitor from "./WebcamMonitor";

const Step2Interview = ({ interviewData, onFinish }) => {
  const { interviewId, questions, userName } = interviewData;
  const [isIntroPhase, setIntroPhase] = useState(true);

  const [isMicOn, setIsMicOn] = useState(true);
  const recognitionRef = useRef(null);
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(questions[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // NEW: visible error state so failures (timeouts, network issues) show
  // up on screen instead of only in the console.
  const [submitError, setSubmitError] = useState("");
  const [voiceGender, setVoiceGender] = useState("female");
  const [subtitle, setSubtitle] = useState("");

  // NEW (Feature: AI Follow-up Questions)
  const [followUpQuestion, setFollowUpQuestion] = useState(null);
  const [isAnsweringFollowUp, setIsAnsweringFollowUp] = useState(false);
  const [followUpFeedback, setFollowUpFeedback] = useState("");
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const videoRef = useRef(null);
  // NEW (Feature: Webcam Confidence Detection)
  const webcamRef = useRef(null);

  const currentQuestion = questions[currentIndex];

  // NEW (bug fix — found during testing): the entire question-asking
  // flow used to be gated on `selectedVoice` being set. If the browser
  // never fires speechSynthesis.onvoiceschanged (happens on some
  // Windows/browser combinations), selectedVoice stays null FOREVER,
  // which meant the interview just silently froze — no questions asked,
  // mic never auto-started, nothing. `voiceReady` decouples "the
  // interview is allowed to proceed" from "a real TTS voice exists": it
  // becomes true either when a voice is actually found, OR after a 3s
  // timeout with none found (in which case the interview continues in
  // text-only mode — questions still display, mic still works, the AI
  // just won't be spoken aloud).
  const [voiceReady, setVoiceReady] = useState(false);

  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const femaleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("monica") ||
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("female")
      );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        setVoiceReady(true);
        return;
      }

      const maleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("mark") ||
          v.name.toLowerCase().includes("male")
      );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        setVoiceReady(true);
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("female");
      setVoiceReady(true);
    };

    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;

    // Safety net: if no voice has loaded within 3 seconds, stop waiting
    // and let the interview proceed without narration instead of hanging
    // indefinitely.
    const fallbackTimer = setTimeout(() => setVoiceReady(true), 3000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  const stopMic = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* no-op */
      }
    }
  };

  const startMic = () => {
    if (recognitionRef.current && !isAIPlaying) {
      try {
        recognitionRef.current.start();
      } catch {
        /* no-op: recognition may already be running */
      }
    }
  };

  /* ------------ SPEAK FUNCTION -------------- */
  const speakText = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const humanText = text.replace(/,/g, ", ... ").replace(/\./g, ". ... ");

      const utterance = new SpeechSynthesisUtterance(humanText);
      utterance.voice = selectedVoice;
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsAIPlaying(true);
        stopMic();
        // NEW: play() returns a Promise that can reject (e.g. browser
        // autoplay policy). Left unhandled, that's an unhandled promise
        // rejection - harmless to functionality here (video is a visual
        // extra, not required for the interview to work) but worth
        // catching cleanly instead of leaving it as console noise.
        videoRef.current?.play().catch(() => { });
      };

      utterance.onend = () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
        setIsAIPlaying(false);

        if (isMicOn) {
          startMic();
        }

        setTimeout(() => {
          setSubtitle("");
          resolve();
        }, 300);
      };

      setSubtitle(text);
      window.speechSynthesis.speak(utterance);
    });
  };

  // BUG FIX: intro-phase condition was inverted. `isIntroPhase` starts
  // `true`, but the original checked `if (!isIntroPhase)` to run the
  // intro speech — that's the OPPOSITE of when it should run. It skipped
  // the greeting entirely and jumped straight to asking questions.
  useEffect(() => {
    if (!voiceReady) return;

    const runIntro = async () => {
      if (isIntroPhase) {
        await speakText(
          `Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`
        );

        await speakText(
          "I'll ask you a few questions. Just answer naturally, and take your time. Let's begin."
        );

        setIntroPhase(false);
      } else if (currentQuestion) {
        await new Promise((r) => setTimeout(r, 1000));

        if (currentIndex === questions.length - 1) {
          await speakText("Alright, this one might be a bit more challenging.");
        }

        await speakText(currentQuestion.question);

        if (isMicOn) {
          startMic();
        }
      }
    };

    runIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceReady, isIntroPhase, currentIndex]);

  // BUG FIX: `if (!currentIndex) return;` skipped the timer entirely on
  // question 1 because currentIndex is 0 there, and 0 is falsy. Removed
  // that check — the timer should run for every question including the
  // first one.
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    // NOTE: no eslint-disable needed here — the setState call happens
    // inside the setInterval CALLBACK (fires later, async), not
    // synchronously during the effect body itself, so ESLint's
    // react-hooks/set-state-in-effect rule correctly doesn't flag this
    // at all. (An earlier version of this file had an unnecessary
    // disable comment here, which ESLint then flagged as "unused".)
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
    // BUG FIX: `currentQuestion` is read inside this effect
    // (`if (!currentQuestion) return;`) but was missing from the
    // dependency array — added it. It's derived from
    // `questions[currentIndex]`, so it only changes exactly when
    // `currentIndex` already changes, meaning this doesn't cause any
    // extra re-runs beyond what already happens.
  }, [isIntroPhase, currentIndex, currentQuestion, isSubmitting]);

  useEffect(() => {
    if (!isIntroPhase && currentQuestion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(currentQuestion.timeLimit || 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) return;

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    // BUG FIX: `continuos` typo -> `continuous`. The mistyped property
    // did nothing (it just created a random extra field on the object);
    // the real `continuous` flag was left at its default.
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setAnswer((prev) => prev + " " + transcript);
    };

    // BUG FIX: was assigning to `recognition.current` (a made-up property
    // on the recognition object itself, not the ref). This meant
    // `recognitionRef.current` stayed `null` forever, so startMic/stopMic
    // silently did nothing and the mic never actually worked.
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognition.abort();
    };
    // NOTE: no eslint-disable needed here either — this effect only uses
    // the stable `setAnswer` setter and refs, nothing that exhaustive-deps
    // actually requires in the array. (Same "unnecessary disable" mistake
    // as above — removed it.)
  }, []);

  const toggleMic = () => {
    if (isMicOn) {
      stopMic();
    } else {
      startMic();
    }
    setIsMicOn(!isMicOn);
  };

  const submitAnswer = async () => {
    if (isSubmitting) return;

    stopMic();
    setIsSubmitting(true);

    try {
      // NEW (Feature: Webcam Confidence Detection) - pull this question's
      // accumulated stats and reset the window for the next question.
      const webcamStats = webcamRef.current?.getStatsAndReset() || {
        eyeContactPercentage: null,
        dominantExpression: null,
      };

      // BUG FIX: lowercase `serverUrl` used instead of the imported
      // `ServerUrl` — this was a ReferenceError waiting to happen.
      // NEW: added a timeout so a hung request fails visibly instead of
      // leaving the button stuck on "Submitting..." forever with no
      // feedback (found during testing - backend's AI call had no
      // timeout either, now fixed there too).
      const result = await axios.post(
        ServerUrl + "/api/interview/submit-answer",
        {
          interviewId,
          questionIndex: currentIndex,
          answer,
          timeTaken: currentQuestion.timeLimit - timeLeft,
          eyeContactPercentage: webcamStats.eyeContactPercentage,
          dominantExpression: webcamStats.dominantExpression,
        },
        { withCredentials: true, timeout: 40000 }
      );

      setSubmitError("");
      setFeedback(result.data.feedback);
      // NEW (Feature: AI Follow-up Questions) — only present when the
      // backend decided this answer was weak enough to probe deeper.
      if (result.data.followUpQuestion) {
        setFollowUpQuestion(result.data.followUpQuestion);
      }
      await speakText(result.data.feedback);
      setIsSubmitting(false);
    } catch (error) {
      console.log(error);
      // NEW: surface a real, visible message instead of silently
      // reverting the button with nothing else happening — the person
      // was previously left guessing why nothing occurred.
      setSubmitError(
        error.code === "ECONNABORTED"
          ? "The AI took too long to respond. Please try submitting again."
          : error.response?.data?.message || "Something went wrong. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    setAnswer("");
    setFeedback("");
    // NEW: reset follow-up state so it doesn't leak into the next question
    setFollowUpQuestion(null);
    setIsAnsweringFollowUp(false);
    setFollowUpFeedback("");
    // BUG FIX (found during testing - this was the real cause of
    // "Submitting..." appearing instantly on a brand new question):
    // when the PREVIOUS question was auto-submitted because its timer
    // hit 0, `timeLeft` stayed at 0. The separate effect that resets
    // `timeLeft` for the new question only runs AFTER `currentIndex`
    // changes and a re-render happens — leaving a brief window where
    // the new question is showing but `timeLeft` is still the stale 0
    // from before. The auto-submit-on-timeout effect (which fires
    // whenever `timeLeft` becomes 0) could catch that stale value and
    // instantly "auto-submit" an empty answer for the question the
    // candidate hadn't even started reading yet.
    // Fix: reset timeLeft HERE, in the same update as `currentIndex`,
    // so there's never a moment where the new question is visible with
    // a leftover 0 timer.
    setIsSubmitting(false);
    setSubmitError("");

    if (currentIndex + 1 >= questions.length) {
      finishInterview();
      return;
    }

    await speakText("Alright, let's move to the next question.");

    const nextQuestion = questions[currentIndex + 1];
    setTimeLeft(nextQuestion?.timeLimit || 60);
    setCurrentIndex(currentIndex + 1);
    setTimeout(() => {
      if (isMicOn) startMic();
    }, 500);
  };

  // NEW (Feature: AI Follow-up Questions)
  // Called when the candidate chooses to answer the AI's probing
  // follow-up instead of skipping straight to the next question.
  const startFollowUp = async () => {
    setAnswer("");
    setIsAnsweringFollowUp(true);
    await speakText(followUpQuestion);
    if (isMicOn) startMic();
  };

  const submitFollowUpAnswer = async () => {
    if (isSubmittingFollowUp) return;
    stopMic();
    setIsSubmittingFollowUp(true);

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/submit-followup",
        { interviewId, questionIndex: currentIndex, answer },
        { withCredentials: true, timeout: 40000 }
      );

      // BUG FIX (integration issue found during testing pass): the
      // webcam confidence-detection window was only being read+reset
      // inside submitAnswer(), never here. That meant any frames
      // captured WHILE the candidate answered the follow-up question
      // stayed in the accumulator and got wrongly attributed to the
      // NEXT question's eye-contact/expression stats instead of being
      // discarded. Follow-up answers don't get their own webcam metrics
      // (only the main answer's engagement is tracked per question), so
      // we just read-and-discard here to start a clean window.
      webcamRef.current?.getStatsAndReset();

      setSubmitError("");
      setFollowUpFeedback(result.data.feedback);
      await speakText(result.data.feedback);
      setIsSubmittingFollowUp(false);
    } catch (error) {
      console.log(error);
      setSubmitError(
        error.code === "ECONNABORTED"
          ? "The AI took too long to respond. Please try submitting again."
          : error.response?.data?.message || "Something went wrong. Please try again."
      );
      setIsSubmittingFollowUp(false);
    }
  };

  const finishInterview = async () => {
    stopMic();
    setIsMicOn(false);
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

  // BUG FIX: this effect called `handleSubmit()`, a function that was
  // never defined anywhere in the file (the real function is named
  // `submitAnswer`). Time running out would have crashed with
  // "handleSubmit is not defined".
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    if (timeLeft === 0 && !isSubmitting && !feedback) {
      // Same false-positive as above: submitAnswer() calls setIsSubmitting
      // inside an async function triggered from the effect, not
      // synchronously in the effect body itself.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      submitAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
        {/* video section */}
        <div className="bg-white rounded-2xl border p-5 flex flex-col" style={{ borderColor: "var(--border)" }}>
          <div
            className="focus-ring-bg rounded-xl overflow-hidden aspect-video flex items-center justify-center mb-4"
            style={{ backgroundColor: "#0F1420" }}
          >
            <video
              src={videoSource}
              key={videoSource}
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            />
          </div>

          {subtitle && (
            <div
              className="rounded-lg px-4 py-3 text-sm mb-4"
              style={{ backgroundColor: "var(--surface-muted)", color: "var(--ink)" }}
            >
              {subtitle}
            </div>
          )}

          {/* NEW (Feature: Webcam Confidence Detection) */}
          <div className="mb-4">
            <WebcamMonitor ref={webcamRef} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6B7280" }}>
              Interview Status
            </span>
            {isAIPlaying && (
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ backgroundColor: "rgba(232,163,61,0.15)", color: "var(--gold)" }}
              >
                AI Speaking
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />

            <div className="flex gap-6 font-mono">
              <div className="text-center">
                <div className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                  {currentIndex + 1}
                </div>
                <div className="text-xs" style={{ color: "#6B7280" }}>
                  Current
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                  {questions.length}
                </div>
                <div className="text-xs" style={{ color: "#6B7280" }}>
                  Total
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Text section */}
        <div className="bg-white rounded-2xl border p-5 flex flex-col" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            AI Smart Interview
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

          {!isIntroPhase && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--indigo)" }}>
                Question {currentIndex + 1} of {questions.length}
              </p>
              <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {currentQuestion?.question}
              </div>

              {/* NEW (Feature: AI Follow-up Questions) - shown once the
                  candidate has chosen to dig into the follow-up */}
              {isAnsweringFollowUp && (
                <div
                  className="mt-3 rounded-lg px-3 py-2.5 text-sm"
                  style={{ backgroundColor: "rgba(59,79,224,0.08)", color: "var(--indigo)" }}
                >
                  <span className="font-semibold">Follow-up: </span>
                  {followUpQuestion}
                </div>
              )}
            </div>
          )}

          <textarea
            placeholder={
              isAnsweringFollowUp
                ? "Type your follow-up answer here..."
                : "Type your answer here..."
            }
            onChange={(e) => setAnswer(e.target.value)}
            value={answer}
            rows={8}
            className="w-full rounded-xl border p-4 text-sm outline-none resize-none flex-1"
            style={{ borderColor: "var(--border)" }}
          />

          {/* Stage 1: answering the main question */}
          {!feedback && (
            <div className="mt-4">
              {/* NEW: visible error banner - previously a failed/timed-out
                  submit just silently reverted the button with no
                  explanation, leaving the person confused about what
                  happened. */}
              {submitError && (
                <div
                  className="text-xs rounded-lg px-3 py-2 mb-3"
                  style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
                >
                  {submitError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.95 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isMicOn ? "rgba(59,79,224,0.1)" : "var(--surface-muted)",
                    color: isMicOn ? "var(--indigo)" : "#9CA3AF",
                  }}
                >
                  {isMicOn ? <FaMicrophone size={18} /> : <FaMicrophoneSlash size={18} />}
                </motion.button>

                <motion.button
                  onClick={submitAnswer}
                  disabled={isSubmitting}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 text-white font-semibold rounded-xl py-3 disabled:opacity-50"
                  style={{ backgroundColor: "var(--indigo)" }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Answer"}
                </motion.button>
              </div>
            </div>
          )}

          {/* Stage 2: main feedback shown, deciding whether to take the
              follow-up (NEW - Feature: AI Follow-up Questions) */}
          {feedback && !isAnsweringFollowUp && !followUpFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
            >
              <p className="text-sm mb-3" style={{ color: "var(--ink)" }}>
                {feedback}
              </p>

              {followUpQuestion ? (
                <div className="flex flex-col gap-2">
                  <motion.button
                    onClick={startFollowUp}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3"
                    style={{ backgroundColor: "var(--indigo)" }}
                  >
                    Answer Follow-up Question
                  </motion.button>
                  <button
                    onClick={handleNext}
                    className="w-full text-sm font-medium py-2"
                    style={{ color: "#6B7280" }}
                  >
                    Skip and go to next question
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3"
                  style={{ backgroundColor: "var(--emphasis)" }}
                >
                  Next Question <BsArrowRight size={18} />
                </button>
              )}
            </motion.div>
          )}

          {/* Stage 3: actively answering the follow-up */}
          {isAnsweringFollowUp && !followUpFeedback && (
            <div className="mt-4">
              {submitError && (
                <div
                  className="text-xs rounded-lg px-3 py-2 mb-3"
                  style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
                >
                  {submitError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.95 }}
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isMicOn ? "rgba(59,79,224,0.1)" : "var(--surface-muted)",
                    color: isMicOn ? "var(--indigo)" : "#9CA3AF",
                  }}
                >
                  {isMicOn ? <FaMicrophone size={18} /> : <FaMicrophoneSlash size={18} />}
                </motion.button>

                <motion.button
                  onClick={submitFollowUpAnswer}
                  disabled={isSubmittingFollowUp}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 text-white font-semibold rounded-xl py-3 disabled:opacity-50"
                  style={{ backgroundColor: "var(--indigo)" }}
                >
                  {isSubmittingFollowUp ? "Submitting..." : "Submit Follow-up Answer"}
                </motion.button>
              </div>
            </div>
          )}

          {/* Stage 4: follow-up feedback, then finally move on */}
          {followUpFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
            >
              <p className="text-sm mb-3" style={{ color: "var(--ink)" }}>
                {followUpFeedback}
              </p>

              <button
                onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3"
                style={{ backgroundColor: "var(--emphasis)" }}
              >
                Next Question <BsArrowRight size={18} />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step2Interview;