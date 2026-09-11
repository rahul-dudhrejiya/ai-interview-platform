import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as faceapi from "face-api.js";
import { FaVideo, FaVideoSlash } from "react-icons/fa";

// Models are served locally from /public/models so this doesn't depend on
// a third-party CDN staying online during the interview.
const MODEL_URL = "/models";

// Runs a small webcam preview in the corner of the interview screen and
// periodically (every 2s) checks: is a face visible (proxy for "looking
// at the camera / engaged"), and what's the dominant facial expression.
// Stats accumulate per-question and get read out (then reset) via
// getStatsAndReset() whenever the parent submits an answer - same
// external-API pattern as a stopwatch lap.
const WebcamMonitor = forwardRef((props, ref) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const statsRef = useRef({ framesChecked: 0, framesWithFace: 0, expressionCounts: {} });

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.log("Failed to load face-api models:", error);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !cameraOn) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 240, height: 180 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPermissionDenied(false);
      } catch (error) {
        console.log("Camera permission denied:", error);
        setPermissionDenied(true);
      }
    };
    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [modelsLoaded, cameraOn]);

  useEffect(() => {
    if (!modelsLoaded || permissionDenied || !cameraOn) return;

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== 4) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        statsRef.current.framesChecked += 1;

        if (detection) {
          statsRef.current.framesWithFace += 1;
          const topExpression = Object.entries(detection.expressions).sort(
            (a, b) => b[1] - a[1]
          )[0][0];
          statsRef.current.expressionCounts[topExpression] =
            (statsRef.current.expressionCounts[topExpression] || 0) + 1;
        }
      } catch {
        // Detection can occasionally fail on a mid-transition frame -
        // just skip that tick rather than crashing the interview.
      }
    }, 2000);

    return () => clearInterval(intervalRef.current);
  }, [modelsLoaded, permissionDenied, cameraOn]);

  // Exposes a single method the parent (Step2Interview) calls right
  // before submitting each answer, to pull this question's stats and
  // start a fresh window for the next question.
  useImperativeHandle(ref, () => ({
    getStatsAndReset: () => {
      const { framesChecked, framesWithFace, expressionCounts } = statsRef.current;

      let result = { eyeContactPercentage: null, dominantExpression: null };

      if (framesChecked > 0) {
        result.eyeContactPercentage = Math.round((framesWithFace / framesChecked) * 100);
        const entries = Object.entries(expressionCounts);
        if (entries.length > 0) {
          result.dominantExpression = entries.sort((a, b) => b[1] - a[1])[0][0];
        }
      }

      statsRef.current = { framesChecked: 0, framesWithFace: 0, expressionCounts: {} };
      return result;
    },
  }));

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative w-24 h-[72px] rounded-lg overflow-hidden border shrink-0"
        style={{ borderColor: "var(--border)", backgroundColor: "#0F1420" }}
      >
        {cameraOn && !permissionDenied ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FaVideoSlash size={14} style={{ color: "#6B7280" }} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => setCameraOn((v) => !v)}
          className="text-xs font-medium flex items-center gap-1.5 px-2 py-1 rounded-md border"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          type="button"
        >
          {cameraOn ? <FaVideo size={11} /> : <FaVideoSlash size={11} />}
          {cameraOn ? "Confidence Cam On" : "Camera Off"}
        </button>
        <p className="text-[10px] leading-tight max-w-[140px]" style={{ color: "#9CA3AF" }}>
          {permissionDenied
            ? "Camera permission denied - engagement won't be scored."
            : "Not recorded or saved, only used live for engagement scoring."}
        </p>
      </div>
    </div>
  );
});

WebcamMonitor.displayName = "WebcamMonitor";

export default WebcamMonitor;