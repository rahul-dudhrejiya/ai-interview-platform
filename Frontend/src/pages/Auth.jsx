import { FaRobot } from "react-icons/fa6";
import { IoSparklesSharp } from "react-icons/io5";
import { motion } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { auth, provider } from "../utils/firebase";
import { signInWithPopup } from "firebase/auth";
import { ServerUrl } from "../App";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";

const Auth = ({ isModel = false }) => {
  const dispatch = useDispatch();

  const handleGoogleAuth = async () => {
    try {
      const response = await signInWithPopup(auth, provider);
      const user = response.user;
      const name = user.displayName;
      const email = user.email;
      const result = await axios.post(
        ServerUrl + "/api/auth/google",
        { name, email },
        { withCredentials: true }
      );

      dispatch(setUserData(result.data));
    } catch (error) {
      console.log(error);
      dispatch(setUserData(null));
    }
  };

  return (
    <div
      className={`w-full flex items-center justify-center px-4 ${
        isModel ? "" : "min-h-screen py-16"
      }`}
      style={{ backgroundColor: isModel ? "transparent" : "var(--paper)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm rounded-2xl border p-8 text-center"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
        }}
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: "var(--emphasis)" }}
          >
            <FaRobot size={20} />
          </div>
          <h2 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
            aiInterview
          </h2>
        </div>

        <h1
          className="font-display text-2xl font-semibold mb-1 flex items-center justify-center gap-2"
          style={{ color: "var(--ink)" }}
        >
          Continue with
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full"
            style={{ backgroundColor: "rgba(232,163,61,0.16)", color: "var(--gold)" }}
          >
            <IoSparklesSharp size={14} />
          </span>
        </h1>
        <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
          Sign in to start practicing your next interview.
        </p>

        <motion.button
          onClick={handleGoogleAuth}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-3 bg-white border rounded-xl px-6 py-3 font-medium shadow-sm"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        >
          <FcGoogle size={20} />
          Continue with Google
        </motion.button>
      </motion.div>
    </div>
  );
};

export default Auth;