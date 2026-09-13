import { useEffect, useRef, useState } from "react";
// BUG FIX: import paths were missing a slash: "..assets/..." resolves to
// a nonexistent path. Correct relative path is "../assets/...".
import maleVideo from "../assets/videos/male-ai.mp4";
import femaleVideo from "../assets/videos/female-ai.mp4";
import Timer from "./Timer";
import { motion } from "motion/react";
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaStop, FaCircle } from "react-icons/fa";
import axios from "axios";
// BUG FIX: import path was '.../App' (invalid) -> '../App'
import { ServerUrl } from "../utils/constants";
import { BsArrowRight } from "react-icons/bs";
// NEW (Feature: Webcam Confidence Detection)
import WebcamMonitor from "./WebcamMonitor";

const Step2Interview = ({ interviewData, onFinish }) => {
  const { interviewId, questions, userName } = interviewData;
  const [isIntroPhase, setIntroPhase] = useState(true);

  const [isMicOn, setIsMicOn] = useState(true);
  const isMicOnRef = useRef(isMicOn);
  const shouldListenRef = useRef(true);
  const [isMicActive, setIsMicActive] = useState(false);

  const recognitionInstanceRef = useRef(null);
  const isListeningActiveRef = useRef(false);
  const restartTimerRef = useRef(null);

  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const isAIPlayingRef = useRef(isAIPlaying);

  const [interimText, setInterimText] = useState("");
  const interimTextRef = useRef("");

  // NEW: Whisper Audio Recorder States ("The Other Way" for 100% reliable voice input)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const [micLang, setMicLang] = useState(() => {
    return (
      localStorage.getItem("mic_lang") ||
      (typeof navigator !== "undefined" &&
      navigator.language?.toLowerCase().startsWith("en-in")
        ? "en-IN"
        : "en-US")
    );
  });
  const micLangRef = useRef(micLang);

  useEffect(() => {
    micLangRef.current = micLang;
  }, [micLang]);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    isAIPlayingRef.current = isAIPlaying;
  }, [isAIPlaying]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
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
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setVoiceReady(true);
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      if (!voices || !voices.length) return;

      // Female voices (Windows Zira, Google, Samantha, etc.)
      const femaleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("monica") ||
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("female") ||
          (v.lang?.toLowerCase().startsWith("en") && v.name.toLowerCase().includes("female"))
      );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        setVoiceReady(true);
        return;
      }

      // Male voices (David, Mark, etc.)
      const maleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("mark") ||
          v.name.toLowerCase().includes("male") ||
          (v.lang?.toLowerCase().startsWith("en") && v.name.toLowerCase().includes("male"))
      );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        setVoiceReady(true);
        return;
      }

      // English fallback
      const englishVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
      if (englishVoice) {
        setSelectedVoice(englishVoice);
        setVoiceGender("female");
        setVoiceReady(true);
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("female");
      setVoiceReady(true);
    };

    loadVoice();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoice;
    }

    // Unblock interview progression within 1 second even if system voices load slowly
    const fallbackTimer = setTimeout(() => setVoiceReady(true), 1000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  // CRITICAL FIX: Flush any pending interim speech into permanent answer.
  // Guarantees words are NEVER wiped out when Chrome pauses or restarts.
  const flushInterim = () => {
    const pending = interimTextRef.current.trim();
    if (pending) {
      const prev = answerRef.current.trim();
      const updated = prev ? `${prev} ${pending}` : pending;
      answerRef.current = updated;
      setAnswer(updated);
      interimTextRef.current = "";
      setInterimText("");
      return updated;
    }
    return answerRef.current;
  };

  // Dedicated single-instance Web Speech Recognition
  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionClass) {
      console.warn("Web SpeechRecognition not supported in this browser. MediaRecorder Whisper will be used.");
      return;
    }

    const rec = new SpeechRecognitionClass();
    rec.lang = micLangRef.current || "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      isListeningActiveRef.current = true;
      setIsMicActive(true);
    };

    rec.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || "";
        if (item.isFinal) {
          finalChunk += " " + text.trim();
        } else {
          interimChunk += " " + text.trim();
        }
      }

      if (finalChunk.trim()) {
        const cleanFinal = finalChunk.trim();
        const prev = answerRef.current.trim();
        const updated = prev ? `${prev} ${cleanFinal}` : cleanFinal;
        answerRef.current = updated;
        setAnswer(updated);
      }

      const cleanInterim = interimChunk.trim();
      interimTextRef.current = cleanInterim;
      setInterimText(cleanInterim);
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech") return;
      console.warn("Speech recognition notice:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSubmitError(
          "Browser live dictation was blocked. You can still use the 'Record Answer (AI Whisper)' button below!"
        );
        setIsMicOn(false);
        isMicOnRef.current = false;
        shouldListenRef.current = false;
      }
    };

    rec.onend = () => {
      isListeningActiveRef.current = false;
      setIsMicActive(false);
      flushInterim();

      // Auto-restart if user still wants mic on and AI is not speaking
      if (shouldListenRef.current && isMicOnRef.current && !isAIPlayingRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && isMicOnRef.current && !isAIPlayingRef.current && !isListeningActiveRef.current) {
            try {
              rec.start();
            } catch {
              /* ignore if already active */
            }
          }
        }, 200);
      }
    };

    recognitionInstanceRef.current = rec;

    return () => {
      clearTimeout(restartTimerRef.current);
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onstart = null;
      try {
        rec.stop();
        rec.abort();
      } catch {
        /* no-op */
      }
    };
  }, []);

  const startMic = () => {
    shouldListenRef.current = true;
    if (!recognitionInstanceRef.current) return;
    if (isListeningActiveRef.current || isAIPlayingRef.current) return;
    try {
      recognitionInstanceRef.current.start();
    } catch {
      /* ignore if already running */
    }
  };

  const stopMic = () => {
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
    flushInterim();
    setIsMicActive(false);
    if (recognitionInstanceRef.current && isListeningActiveRef.current) {
      try {
        recognitionInstanceRef.current.stop();
      } catch {
        /* no-op */
      }
    }
  };

  const toggleMic = () => {
    const nextMic = !isMicOn;
    setIsMicOn(nextMic);
    isMicOnRef.current = nextMic;
    if (nextMic) {
      startMic();
    } else {
      stopMic();
    }
  };

  const handleLangChange = (newLang) => {
    setMicLang(newLang);
    micLangRef.current = newLang;
    localStorage.setItem("mic_lang", newLang);
    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.lang = newLang;
      } catch {
        /* no-op */
      }
    }
  };

  // -------------------------------------------------------------
  // NEW: Whisper Audio Recorder ("The Other Way" requested by user)
  // Direct microphone recording sent to Groq Whisper AI
  // Works on ALL browsers, even if Web Speech API is blocked or offline!
  // -------------------------------------------------------------
  const startAudioRecording = async () => {
    try {
      stopMic(); // pause live dictation so audio streams don't clash

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        setRecordingSeconds(0);
        setIsRecordingAudio(false);

        // Stop microphone hardware capture
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        const actualMime = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

        if (audioBlob.size < 500) {
          return; // Recording was essentially empty
        }

        setIsTranscribing(true);
        setSubmitError("");

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "answer.webm");

          const response = await axios.post(
            ServerUrl + "/api/interview/transcribe-audio",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              withCredentials: true,
              timeout: 35000,
            }
          );

          if (response.data?.text) {
            const transcribed = response.data.text.trim();
            setAnswer((prev) => {
              const p = prev.trim();
              const updated = p ? `${p} ${transcribed}` : transcribed;
              answerRef.current = updated;
              return updated;
            });
          }
        } catch (err) {
          console.error("Whisper transcription failed:", err);
          setSubmitError(
            err.response?.data?.message ||
              "Failed to transcribe audio. Please try again or type directly into the box."
          );
        } finally {
          setIsTranscribing(false);
          if (isMicOnRef.current && !isAIPlayingRef.current) {
            startMic();
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone recording access error:", err);
      setSubmitError(
        "Microphone access was denied. Please allow microphone permission in your browser address bar."
      );
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("MediaRecorder stop notice:", err);
      }
    }
  };

  /* ------------ SPEAK FUNCTION -------------- */
  const speakText = (text) => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setSubtitle(text);
        resolve();
        return;
      }

      let finished = false;
      let safetyTimer = null;
      let resumeInterval = null;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (safetyTimer) clearTimeout(safetyTimer);
        if (resumeInterval) clearInterval(resumeInterval);

        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          } catch {
            /* no-op */
          }
        }
        setIsAIPlaying(false);
        isAIPlayingRef.current = false;

        if (isMicOnRef.current) {
          startMic();
        }

        setTimeout(() => {
          setSubtitle("");
          resolve();
        }, 250);
      };

      try {
        window.speechSynthesis.cancel();
      } catch {
        /* no-op */
      }

      const humanText = text.replace(/,/g, ", ... ").replace(/\./g, ". ... ");
      const utterance = new SpeechSynthesisUtterance(humanText);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.02;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsAIPlaying(true);
        isAIPlayingRef.current = true;
        stopMic();
        videoRef.current?.play().catch(() => {});
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn("Speech synthesis notice:", e);
        finish();
      };

      // Safety fallback: prevents promises from hanging if browser drops utterance end
      const wordCount = (text || "").split(/\s+/).length;
      const timeoutMs = Math.max(3000, (wordCount / 2.0) * 1000 + 3500);
      safetyTimer = setTimeout(finish, timeoutMs);

      // Keep speech active across Chrome's 15s pause limit
      resumeInterval = setInterval(() => {
        if (window.speechSynthesis?.speaking && window.speechSynthesis?.paused) {
          window.speechSynthesis.resume();
        }
      }, 3000);

      setSubtitle(text);
      try {
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn("speechSynthesis.speak error:", err);
        finish();
      }
    });
  };

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
        await new Promise((r) => setTimeout(r, 600));

        if (currentIndex === questions.length - 1) {
          await speakText("Alright, this one might be a bit more challenging.");
        }

        await speakText(currentQuestion.question);

        if (isMicOnRef.current) {
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

  const submitAnswer = async () => {
    if (isSubmitting) return;

    if (isRecordingAudio) {
      stopAudioRecording();
    }
    const finalAnswer = flushInterim();
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
          answer: finalAnswer,
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
    if (isRecordingAudio) {
      stopAudioRecording();
    }
    answerRef.current = "";
    interimTextRef.current = "";
    setAnswer("");
    setInterimText("");
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
      if (isMicOnRef.current) startMic();
    }, 500);
  };

  // NEW (Feature: AI Follow-up Questions)
  // Called when the candidate chooses to answer the AI's probing
  // follow-up instead of skipping straight to the next question.
  const startFollowUp = async () => {
    if (isRecordingAudio) {
      stopAudioRecording();
    }
    answerRef.current = "";
    interimTextRef.current = "";
    setAnswer("");
    setInterimText("");
    setIsAnsweringFollowUp(true);
    await speakText(followUpQuestion);
    if (isMicOnRef.current) startMic();
  };

  const submitFollowUpAnswer = async () => {
    if (isSubmittingFollowUp) return;
    if (isRecordingAudio) {
      stopAudioRecording();
    }
    const finalAnswer = flushInterim();
    stopMic();
    setIsSubmittingFollowUp(true);

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/submit-followup",
        { interviewId, questionIndex: currentIndex, answer: finalAnswer },
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
    stopAudioRecording();
    setIsMicOn(false);
    isMicOnRef.current = false;
    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/finish",
        { interviewId },
        { withCredentials: true }
      );

      onFinish(result.data);
    } catch (error) {
      console.log(error);
      setSubmitError(
        error.response?.data?.message ||
          "Failed to complete interview. Please check your connection and try again."
      );
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
      stopMic();
      stopAudioRecording();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-semibold" style={{ color: "var(--indigo)" }}>
                  Question {currentIndex + 1} of {questions.length}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      isAnsweringFollowUp ? followUpQuestion : currentQuestion?.question
                    )
                  }
                  title="Click to hear question read aloud"
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-indigo-200 text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100 transition"
                >
                  <FaVolumeUp size={12} />
                  <span>Hear Question</span>
                </button>
              </div>
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

          <div className="relative flex-1 flex flex-col">
            <textarea
              placeholder={
                isAnsweringFollowUp
                  ? "Speak or type your follow-up answer here..."
                  : "Speak or type your answer here..."
              }
              onChange={(e) => {
                const val = e.target.value;
                answerRef.current = val;
                setAnswer(val);
                interimTextRef.current = "";
                setInterimText("");
              }}
              value={
                interimText
                  ? (answer ? answer.trimEnd() + " " : "") + interimText
                  : answer
              }
              rows={8}
              className="w-full rounded-xl border p-4 text-sm outline-none resize-none flex-1 font-normal leading-relaxed"
              style={{ borderColor: "var(--border)" }}
            />

            {interimText && (
              <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-indigo-50/90 border border-indigo-200 rounded-lg text-xs text-indigo-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping shrink-0"></span>
                <span className="truncate">Hearing: "{interimText}"</span>
              </div>
            )}
          </div>

          {/* Stage 1: answering the main question */}
          {!feedback && (
            <div className="mt-4">
              {/* Active Voice Status Banner */}
              {isRecordingAudio ? (
                <div className="flex items-center justify-between gap-2 mb-2.5 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0"></span>
                    <span>
                      Recording Voice: {Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopAudioRecording}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                  >
                    Finish & Convert
                  </button>
                </div>
              ) : isTranscribing ? (
                <div className="flex items-center gap-2 mb-2.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 font-semibold animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping shrink-0"></span>
                  <span>Transcribing with Groq Whisper AI...</span>
                </div>
              ) : isMicOn && !isAIPlaying ? (
                <div className="flex items-center gap-2 mb-2.5 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Live dictation active — speak to type, or use "Record (Whisper AI)" below.</span>
                </div>
              ) : null}

              {/* Error banner */}
              {submitError && (
                <div
                  className="text-xs rounded-lg px-3 py-2 mb-3"
                  style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
                >
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Live Dictation Toggle */}
                <motion.button
                  type="button"
                  onClick={toggleMic}
                  whileTap={{ scale: 0.95 }}
                  title={isMicOn ? "Mute Live Dictation" : "Turn On Live Dictation"}
                  className="h-11 px-3 rounded-xl flex items-center gap-2 shrink-0 transition border text-xs font-semibold"
                  style={{
                    backgroundColor: isMicOn ? "rgba(59,79,224,0.12)" : "var(--surface-muted)",
                    borderColor: isMicOn ? "rgba(59,79,224,0.3)" : "var(--border)",
                    color: isMicOn ? "var(--indigo)" : "#9CA3AF",
                  }}
                >
                  {isMicOn ? <FaMicrophone size={15} /> : <FaMicrophoneSlash size={15} />}
                  <span className="hidden sm:inline">{isMicOn ? "Live Dictation" : "Mic Muted"}</span>
                  {isMicOn && isMicActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  )}
                </motion.button>

                {/* 2. Direct Audio Recorder (Whisper AI) - "The Other Way" */}
                {!isRecordingAudio ? (
                  <motion.button
                    type="button"
                    onClick={startAudioRecording}
                    disabled={isTranscribing || isAIPlaying}
                    whileTap={{ scale: 0.97 }}
                    title="Direct microphone recording transcribed by Groq Whisper AI (Works on all browsers)"
                    className="flex items-center gap-2 h-11 px-3.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50 shrink-0 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    <span>{isTranscribing ? "Transcribing..." : "🎙️ Record (Whisper AI)"}</span>
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={stopAudioRecording}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 h-11 px-3.5 rounded-xl text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 transition shrink-0 animate-pulse shadow-md"
                  >
                    <FaStop size={12} />
                    <span>
                      Stop ({Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")})
                    </span>
                  </motion.button>
                )}

                {/* 3. Accent selector */}
                <select
                  value={micLang}
                  onChange={(e) => handleLangChange(e.target.value)}
                  className="h-11 text-xs border rounded-xl px-2.5 outline-none font-medium bg-white cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                  title="Speech Accent / Language"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>

                {/* 4. Submit Answer */}
                <motion.button
                  onClick={submitAnswer}
                  disabled={isSubmitting || isTranscribing}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 min-w-[120px] h-11 text-white font-semibold rounded-xl py-2.5 disabled:opacity-50 text-xs sm:text-sm"
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
              {/* Active Voice Status Banner */}
              {isRecordingAudio ? (
                <div className="flex items-center justify-between gap-2 mb-2.5 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0"></span>
                    <span>
                      Recording Follow-up Voice: {Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={stopAudioRecording}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                  >
                    Finish & Convert
                  </button>
                </div>
              ) : isTranscribing ? (
                <div className="flex items-center gap-2 mb-2.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 font-semibold animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping shrink-0"></span>
                  <span>Transcribing with Groq Whisper AI...</span>
                </div>
              ) : isMicOn && !isAIPlaying ? (
                <div className="flex items-center gap-2 mb-2.5 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Live dictation active — speak to type, or use "Record (Whisper AI)" below.</span>
                </div>
              ) : null}

              {submitError && (
                <div
                  className="text-xs rounded-lg px-3 py-2 mb-3"
                  style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
                >
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Live Dictation Toggle */}
                <motion.button
                  type="button"
                  onClick={toggleMic}
                  whileTap={{ scale: 0.95 }}
                  title={isMicOn ? "Mute Live Dictation" : "Turn On Live Dictation"}
                  className="h-11 px-3 rounded-xl flex items-center gap-2 shrink-0 transition border text-xs font-semibold"
                  style={{
                    backgroundColor: isMicOn ? "rgba(59,79,224,0.12)" : "var(--surface-muted)",
                    borderColor: isMicOn ? "rgba(59,79,224,0.3)" : "var(--border)",
                    color: isMicOn ? "var(--indigo)" : "#9CA3AF",
                  }}
                >
                  {isMicOn ? <FaMicrophone size={15} /> : <FaMicrophoneSlash size={15} />}
                  <span className="hidden sm:inline">{isMicOn ? "Live Dictation" : "Mic Muted"}</span>
                  {isMicOn && isMicActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  )}
                </motion.button>

                {/* 2. Direct Audio Recorder (Whisper AI) - "The Other Way" */}
                {!isRecordingAudio ? (
                  <motion.button
                    type="button"
                    onClick={startAudioRecording}
                    disabled={isTranscribing || isAIPlaying}
                    whileTap={{ scale: 0.97 }}
                    title="Direct microphone recording transcribed by Groq Whisper AI (Works on all browsers)"
                    className="flex items-center gap-2 h-11 px-3.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-50 shrink-0 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    <span>{isTranscribing ? "Transcribing..." : "🎙️ Record (Whisper AI)"}</span>
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={stopAudioRecording}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 h-11 px-3.5 rounded-xl text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 transition shrink-0 animate-pulse shadow-md"
                  >
                    <FaStop size={12} />
                    <span>
                      Stop ({Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, "0")})
                    </span>
                  </motion.button>
                )}

                {/* 3. Accent selector */}
                <select
                  value={micLang}
                  onChange={(e) => handleLangChange(e.target.value)}
                  className="h-11 text-xs border rounded-xl px-2.5 outline-none font-medium bg-white cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                  title="Speech Accent / Language"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </select>

                {/* 4. Submit Follow-up */}
                <motion.button
                  onClick={submitFollowUpAnswer}
                  disabled={isSubmittingFollowUp || isTranscribing}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 min-w-[120px] h-11 text-white font-semibold rounded-xl py-2.5 disabled:opacity-50 text-xs sm:text-sm"
                  style={{ backgroundColor: "var(--indigo)" }}
                >
                  {isSubmittingFollowUp ? "Submitting..." : "Submit Follow-up"}
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