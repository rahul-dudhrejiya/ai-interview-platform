import { useState } from "react";
import { motion } from "motion/react";
import {
  FaUserTie,
  FaBriefcase,
  FaFileUpload,
  FaMicrophoneAlt,
  FaChartLine,
} from "react-icons/fa";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
// BUG FIX: ServerUrl and setUserData were used below but never imported.
import { ServerUrl } from "../utils/constants";
import { setUserData } from "../redux/userSlice";

const Step1SetUp = ({ onStart }) => {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [mode, setMode] = useState("Technical");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [skills, setSkills] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // NEW (Feature: Custom Company JD Upload)
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [parsingJD, setParsingJD] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [jdError, setJdError] = useState("");

  const handleUploadResume = async () => {
    if (!resumeFile || analyzing) return;
    setAnalyzing(true);
    setResumeError("");

    const formdata = new FormData();
    formdata.append("resume", resumeFile);

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/resume",
        formdata,
        { withCredentials: true }
      );

      setRole(result.data.role || "");
      setExperience(result.data.experience || "");
      setProjects(result.data.projects || []);
      setSkills(result.data.skills || []);
      setResumeText(result.data.resumeText || "");
      setAnalysisDone(true);
      setAnalyzing(false);
    } catch (error) {
      console.error("Resume analysis error:", error);
      const message =
        error.response?.data?.message ||
        "Failed to analyze resume. Please make sure the PDF has readable text or enter details manually.";
      setResumeError(message);
      setAnalyzing(false);
    }
  };

  // NEW (Feature: Custom Company JD Upload)
  const handleUploadJD = async () => {
    if (!jdFile || parsingJD) return;
    setParsingJD(true);
    setJdError("");

    const formdata = new FormData();
    formdata.append("jd", jdFile);

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/parse-jd",
        formdata,
        { withCredentials: true }
      );
      setJdText(result.data.jdText || "");
      setParsingJD(false);
    } catch (error) {
      console.error("JD parse error:", error);
      setJdError(error.response?.data?.message || "Failed to parse JD PDF.");
      setParsingJD(false);
    }
  };

  const [startError, setStartError] = useState("");

  const handleStart = async () => {
    setLoading(true);
    setStartError("");
    try {
      // BUG FIX: original passed FOUR arguments to axios.post — the data
      // object was duplicated (once correctly, once by mistake as a 3rd
      // arg where the config should be). axios.post only accepts
      // (url, data, config) — the duplicate broke the request payload.
      // NEW: timeout so generating 5 questions from the AI fails visibly
      // instead of leaving "Starting..." stuck if OpenRouter hangs.
      const result = await axios.post(
        ServerUrl + "/api/interview/generate-questions",
        // NEW: jdText included so the backend can tailor questions to
        // this specific job description when provided.
        { role, experience, mode, resumeText, projects, skills, jdText },
        { withCredentials: true, timeout: 40000 }
      );

      if (userData) {
        dispatch(setUserData({ ...userData, credits: result.data.creditsLeft }));
      }
      setLoading(false);
      onStart(result.data);
    } catch (error) {
      console.log(error);
      setStartError(
        error.code === "ECONNABORTED"
          ? "The AI took too long to generate questions. Please try again."
          : error.response?.data?.message || "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex justify-center py-14 px-4"
      style={{ backgroundColor: "var(--paper)" }}
    >
      <div className="w-full max-w-3xl">
        {/* Intro card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-3xl font-semibold mb-2" style={{ color: "var(--ink)" }}>
            Start Your AI Interview
          </h2>
          <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
            Practice real interview scenarios with an AI interviewer.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <FaUserTie />, text: "Choose Role & Experience" },
              { icon: <FaMicrophoneAlt />, text: "Smart Voice Interview" },
              { icon: <FaChartLine />, text: "Performance Analytics" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex flex-col items-center gap-2 bg-white rounded-xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(59,79,224,0.1)", color: "var(--indigo)" }}
                >
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-center" style={{ color: "var(--ink)" }}>
                  {item.text}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Setup form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-display text-lg font-semibold mb-5" style={{ color: "var(--ink)" }}>
            Interview Setup
          </h2>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <FaUserTie
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "#9CA3AF" }}
              />
              <input
                type="text"
                placeholder="Enter Role (e.g. Frontend Developer)"
                className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm outline-none"
                style={{ borderColor: "var(--border)" }}
                onChange={(e) => setRole(e.target.value)}
                value={role}
              />
            </div>

            <div className="relative">
              <FaBriefcase
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "#9CA3AF" }}
              />
              <input
                type="text"
                placeholder="Enter Experience (e.g. 2 years / Fresher)"
                className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm outline-none"
                style={{ borderColor: "var(--border)" }}
                // BUG FIX: onChange was calling setRole() instead of
                // setExperience() — typing here silently overwrote the
                // role field instead of the experience field.
                onChange={(e) => setExperience(e.target.value)}
                value={experience}
              />
            </div>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-white"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            >
              <option value="Technical">Technical Interview</option>
              <option value="HR">HR Interview</option>
              {/* NEW (Feature: Coding Round Mode) */}
              <option value="Coding">Coding Round (Live Editor)</option>
            </select>

            {/* NEW (Feature: Custom Company JD Upload) */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--ink)" }}>
                Target Company JD{" "}
                <span className="font-normal" style={{ color: "#9CA3AF" }}>
                  (optional)
                </span>
              </p>
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                Paste a job description or upload it as a PDF - questions
                will be tailored to match it.
              </p>

              <textarea
                placeholder="Paste the company's job description here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border p-3 text-sm outline-none resize-none mb-2"
                style={{ borderColor: "var(--border)" }}
              />

              <div className="flex items-center gap-2">
                <label
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                >
                  {jdFile ? jdFile.name : "Upload PDF instead"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      setJdFile(e.target.files[0]);
                      setJdError("");
                    }}
                  />
                </label>
                {jdFile && (
                  <button
                    onClick={handleUploadJD}
                    disabled={parsingJD}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--indigo)" }}
                  >
                    {parsingJD ? "Extracting..." : "Extract Text"}
                  </button>
                )}
              </div>
              {jdError && (
                <p className="mt-2 text-xs text-red-500 font-medium">
                  {jdError}
                </p>
              )}
            </div>

            {!analysisDone && (
              <motion.div
                whileHover={{ scale: 1.01 }}
                onClick={() => document.getElementById("resumeUpload").click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <FaFileUpload className="mx-auto mb-2" size={20} style={{ color: "var(--indigo)" }} />

                <input
                  type="file"
                  accept="application/pdf"
                  id="resumeUpload"
                  className="hidden"
                  onChange={(e) => {
                    setResumeFile(e.target.files[0]);
                    setResumeError("");
                  }}
                />

                <p className="text-sm" style={{ color: "#6B7280" }}>
                  {resumeFile ? resumeFile.name : "Click to upload resume (optional)"}
                </p>

                {resumeFile && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadResume();
                    }}
                    className="mt-3 text-white text-sm font-medium px-4 py-2 rounded-lg"
                    style={{ backgroundColor: "var(--indigo)" }}
                  >
                    {analyzing ? "Analyzing..." : "Analyze Resume"}
                  </motion.button>
                )}

                {resumeError && (
                  <p className="mt-3 text-xs text-red-500 font-medium px-3 py-1.5 bg-red-50 rounded-lg">
                    {resumeError}
                  </p>
                )}
              </motion.div>
            )}

            {analysisDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
                  Resume Analysis Result
                </h3>

                {projects.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>
                      Projects
                    </p>
                    <ul className="list-disc list-inside text-sm" style={{ color: "var(--ink)" }}>
                      {projects.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {skills.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((s, i) => (
                        <span
                          key={i}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "rgba(59,79,224,0.1)", color: "var(--indigo)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {startError && (
              <div
                className="text-xs rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(214,69,69,0.1)", color: "var(--red)" }}
              >
                {startError}
              </div>
            )}

            <motion.button
              onClick={handleStart}
              disabled={!role || !experience || loading}
              whileHover={{ scale: !role || !experience || loading ? 1 : 1.01 }}
              whileTap={{ scale: !role || !experience || loading ? 1 : 0.98 }}
              className="w-full text-white font-semibold rounded-xl py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--indigo)" }}
            >
              {loading ? "Starting..." : "Start Interview"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Step1SetUp;