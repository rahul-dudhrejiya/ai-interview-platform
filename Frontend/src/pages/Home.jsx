import { useState } from "react";
import Navbar from "../components/Navbar";
import { useSelector } from "react-redux";
import { BsRobot, BsMic, BsClock } from "react-icons/bs";
import {
  HiOutlineChatAlt2,
  HiOutlineDocumentText,
  HiOutlineCode,
  HiOutlineBriefcase,
  HiOutlineChartBar,
  HiOutlineVideoCamera,
  HiOutlineMail,
  HiOutlineSparkles,
} from "react-icons/hi";
// BUG FIX: `Hisparkles` doesn't exist in react-icons/hi — correct export
// name is `HiSparkles`.
import { HiSparkles } from "react-icons/hi";
// BUG FIX: project's package.json only has the "motion" package, not
// "framer-motion" — importing from 'framer-motion' would fail to resolve.
import { motion } from "motion/react";
import AuthModel from "../components/AuthModel";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

// NEW (UI redesign): swapped the old mismatched stock-illustration images
// (which also didn't cover any of the newer features) for a consistent
// icon-tile design system - same visual language already used by the
// Step 1/2/3 cards above. This also means dark mode "just works" here,
// since icons inherit their color from CSS variables instead of being
// baked into static PNGs.
const FEATURES = [
  {
    icon: <HiOutlineChatAlt2 size={20} />,
    title: "AI Answer Evaluation",
    desc: "Every answer is scored on confidence, communication, and correctness — with natural, human-style feedback.",
    accent: "var(--indigo)",
  },
  {
    icon: <HiOutlineDocumentText size={20} />,
    title: "Resume-Based Questions",
    desc: "Upload your resume and get project-specific questions tailored to what you've actually built.",
    accent: "var(--green)",
  },
  {
    icon: <HiOutlineBriefcase size={20} />,
    title: "JD-Tailored Interviews",
    desc: "Paste or upload a company's job description and the AI targets questions to that specific role.",
    accent: "var(--gold)",
  },
  {
    icon: <HiOutlineCode size={20} />,
    title: "Coding Round Mode",
    desc: "A live in-browser code editor with AI code review — correctness, efficiency, and code quality.",
    accent: "var(--indigo)",
  },
  {
    icon: <HiOutlineSparkles size={20} />,
    title: "AI Follow-up Questions",
    desc: "Weak answers get a real-time follow-up question, just like a real interviewer probing deeper.",
    accent: "var(--gold)",
  },
  {
    icon: <HiOutlineVideoCamera size={20} />,
    title: "Webcam Confidence Detection",
    desc: "Live, on-device engagement and expression analysis — never recorded or uploaded anywhere.",
    accent: "var(--red)",
  },
  {
    icon: <HiOutlineChartBar size={20} />,
    title: "Weak-Topic Insights",
    desc: "See which subjects you consistently score lower on, aggregated across all your past interviews.",
    accent: "var(--green)",
  },
  {
    icon: <HiOutlineMail size={20} />,
    title: "PDF & Email Reports",
    desc: "Download a detailed report anytime, or have it emailed straight to your inbox after each session.",
    accent: "var(--indigo)",
  },
];

const MODES = [
  {
    title: "HR Interview Mode",
    desc: "Behavioral and communication-focused questions, evaluated the way a real HR round would.",
    accent: "var(--gold)",
  },
  {
    title: "Technical Interview Mode",
    desc: "Deep technical questioning based on your selected role, experience, and skills.",
    accent: "var(--indigo)",
  },
  {
    title: "Coding Round Mode",
    desc: "Live code editor across JavaScript, Python, Java, or C++, with AI reviewing your solution.",
    accent: "var(--green)",
  },
];

const Home = () => {
  const { userData } = useSelector((state) => state.user);
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  const goTo = (path) => {
    if (!userData) {
      setShowAuth(true);
      return;
    }
    navigate(path);
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "var(--paper)" }}>
      <Navbar />

      <div className="flex-1 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center mb-6">
            <div
              className="bg-white px-4 py-2 rounded-full shadow-sm border flex items-center gap-2 text-xs font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            >
              <HiSparkles className="text-lg" style={{ color: "var(--gold)" }} />
              AI Powered Smart Interview Platform
            </div>
          </div>

          <div className="text-center mb-24">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="font-display text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "var(--ink)" }}
            >
              Practice Interviews with{" "}
              <span style={{ color: "var(--indigo)" }}>AI Intelligence</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-base md:text-lg max-w-2xl mx-auto mb-8"
              style={{ color: "#6B7280" }}
            >
              Role based interview questions with AI feedback and scoring.
              Practice your interview skills and get ready for your dream job.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <motion.button
                onClick={() => goTo("/interview")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="text-white px-7 py-3.5 rounded-full font-semibold shadow-lg"
                style={{ backgroundColor: "var(--emphasis)" }}
              >
                Start Interview
              </motion.button>

              <motion.button
                onClick={() => goTo("/history")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-7 py-3.5 rounded-full font-semibold border bg-white"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                View Interview History
              </motion.button>
            </motion.div>
          </div>

          {/* Steps */}
          <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 mb-28">
            {[
              {
                icon: <BsRobot size={26} />,
                step: "Step 1",
                title: "Role & Experience Selection",
                desc: "AI adjusts the interview questions based on your selected role and experience level.",
                accent: "var(--indigo)",
              },
              {
                icon: <BsMic size={26} />,
                step: "Step 2",
                title: "Smart Voice Interview",
                desc: "AI conducts a voice-based interview, asking questions and evaluating your responses in real-time.",
                accent: "var(--green)",
              },
              {
                icon: <BsClock size={26} />,
                step: "Step 3",
                title: "Timer Based Simulation",
                desc: "Real interview pressure with time tracking on every question.",
                accent: "var(--gold)",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="flex flex-col items-start bg-white p-6 rounded-2xl w-full md:w-72 border hover:shadow-md transition"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${item.accent}1A`, color: item.accent }}
                >
                  {item.icon}
                </div>
                <div className="text-xs font-mono font-semibold mb-1" style={{ color: item.accent }}>
                  {item.step}
                </div>
                <h3 className="font-display text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>
                  {item.title}
                </h3>
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Everything You Need (formerly "Advanced AI Capabilities") */}
          <div className="mb-28">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-display text-2xl md:text-3xl font-semibold text-center mb-3"
              style={{ color: "var(--ink)" }}
            >
              Everything You Need to <span style={{ color: "var(--indigo)" }}>Ace It</span>
            </motion.h2>
            <p className="text-sm text-center mb-12 max-w-xl mx-auto" style={{ color: "#6B7280" }}>
              A full AI interview coach, not just a question generator.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.06 }}
                  whileHover={{ y: -3 }}
                  className="bg-white rounded-2xl border p-5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${item.accent}1A`, color: item.accent }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5" style={{ color: "var(--ink)" }}>
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Interview Modes */}
          <div className="mb-24">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-display text-2xl md:text-3xl font-semibold text-center mb-3"
              style={{ color: "var(--ink)" }}
            >
              Multiple Interview <span style={{ color: "var(--indigo)" }}>Modes</span>
            </motion.h2>
            <p className="text-sm text-center mb-12 max-w-xl mx-auto" style={{ color: "#6B7280" }}>
              Pick the format that matches the round you're actually prepping for.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {MODES.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="bg-white rounded-2xl border p-6 relative overflow-hidden"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: item.accent }}
                  ></div>
                  <h3 className="font-display font-semibold text-base mb-2 mt-1" style={{ color: "var(--ink)" }}>
                    {item.title}
                  </h3>
                  <p className="text-sm" style={{ color: "#6B7280" }}>
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}

      <Footer />
    </div>
  );
};

export default Home;