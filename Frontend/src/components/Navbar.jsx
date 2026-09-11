import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "motion/react";
import { FaRobot, FaBitcoin } from "react-icons/fa";
import { RiLogoutCircleRLine } from "react-icons/ri";
import { FaUserAstronaut } from "react-icons/fa6";
// NEW (Feature: Dark Theme)
import { HiMoon, HiSun } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ServerUrl } from "../utils/constants";
import { setUserData } from "../redux/userSlice";
import AuthModel from "./AuthModel";

const Navbar = () => {
  const { userData } = useSelector((state) => state.user);
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [showAuth, setShowAuth] = useState(false);

  // NEW (Feature: Dark Theme)
  // Lazy-init reads localStorage (if the person already picked a theme
  // before) or falls back to their OS-level preference. The effect below
  // both applies the `.dark` class to <html> (which is what index.css's
  // CSS variables key off of) AND persists the choice for next visit.
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const handleLogout = async () => {
    try {
      await axios.get(ServerUrl + "/api/auth/logout", {
        withCredentials: true,
      });
      localStorage.removeItem("token");
      dispatch(setUserData(null));
      setShowCreditPopup(false);
      setShowUserPopup(false);
      navigate("/");
    } catch (error) {
      console.log(error);
      localStorage.removeItem("token");
      dispatch(setUserData(null));
    }
  };

  return (
    <div className="flex justify-center px-4 pt-6" style={{ backgroundColor: "var(--paper)" }}>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between w-full max-w-4xl bg-white shadow-sm rounded-2xl p-4 border"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div
            className="rounded-xl w-10 h-10 flex items-center justify-center text-white"
            style={{ backgroundColor: "var(--emphasis)" }}
          >
            <FaRobot size={18} />
          </div>
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
            InterviewIQ.AI
          </h1>
        </div>

        <div className="flex items-center gap-4 relative">
          {/* NEW (Feature: Dark Theme) */}
          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle dark mode"
            className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          >
            {isDark ? <HiSun size={18} /> : <HiMoon size={18} />}
          </button>

          {!userData ? (
            // NEW: explicit "Login" button for logged-out users.
            // Previously there was no visible login entry point — the
            // credit/user icons silently opened the auth modal on click,
            // which wasn't obvious. This makes it unambiguous.
            <motion.button
              onClick={() => setShowAuth(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-xl h-10 px-5 flex items-center gap-2 text-white text-sm font-semibold"
              style={{ backgroundColor: "var(--indigo)" }}
            >
              <FaUserAstronaut size={14} />
              Login
            </motion.button>
          ) : (
            <>
              {/* Credits */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCreditPopup(!showCreditPopup);
                    setShowUserPopup(false);
                  }}
                  className="rounded-xl h-10 px-3 flex items-center gap-2 border font-mono text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--ink)" }}
                >
                  <FaBitcoin size={16} color="var(--gold)" />
                  {userData?.credits ?? 0}
                </button>
                {showCreditPopup && (
                  <div
                    className="absolute top-12 right-0 bg-white shadow-lg rounded-xl p-4 w-52 z-10 border"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="text-sm mb-3" style={{ color: "#4B5563" }}>
                      Need more credits to continue interviews?
                    </p>
                    <button
                      onClick={() => navigate("/pricing")}
                      className="w-full text-white text-sm font-medium px-4 py-2 rounded-lg"
                      style={{ backgroundColor: "var(--indigo)" }}
                    >
                      Buy Credits
                    </button>
                  </div>
                )}
              </div>

              {/* User */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowUserPopup(!showUserPopup);
                    setShowCreditPopup(false);
                  }}
                  className="rounded-xl w-10 h-10 flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: "var(--indigo)" }}
                >
                  {userData?.name?.slice(0, 1).toUpperCase()}
                </button>
                {showUserPopup && (
                  <div
                    className="absolute top-12 right-0 bg-white shadow-lg rounded-xl p-4 w-52 z-10 border flex flex-col gap-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="text-sm mb-1" style={{ color: "#4B5563" }}>
                      Logged in as{" "}
                      <span className="font-medium" style={{ color: "var(--ink)" }}>
                        {userData?.name || "User"}
                      </span>
                    </p>

                    <button
                      onClick={() => navigate("/history")}
                      className="text-white text-sm font-medium px-4 py-2 rounded-lg"
                      style={{ backgroundColor: "var(--indigo)" }}
                    >
                      Interview History
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg"
                      style={{ backgroundColor: "var(--surface-muted)", color: "var(--ink)" }}
                    >
                      <RiLogoutCircleRLine size={15} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
      {showAuth && <AuthModel onClose={() => setShowAuth(false)} />}
    </div>
  );
};

export default Navbar;