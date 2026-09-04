import { useEffect, useState } from "react";
// BUG FIX: `axios` was used below but never imported.
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ServerUrl } from "../App";
import { FaArrowLeft, FaTrophy } from "react-icons/fa";
// NEW (Feature: Weak-Topic Tracker)
import { HiSparkles } from "react-icons/hi";

// BUG FIX: component name was lowercase `interviewHistory` — React treats
// lowercase-named components as native HTML tags, not components, which
// would break rendering. Renamed to `InterviewHistory` (PascalCase) and
// the filename should match: InterviewHistory.jsx.
const InterviewHistory = () => {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const getMyInterviews = async () => {
      try {
        // BUG FIX: URL was missing the leading slash:
        // "api/interview/get-interview" -> "/api/interview/get-interview"
        const result = await axios.get(
          ServerUrl + "/api/interview/get-interview",
          { withCredentials: true }
        );

        setInterviews(result.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    // BUG FIX: the fetch function was defined but never actually called —
    // the interview list would always stay empty.
    getMyInterviews();
  }, []);

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white border"
              style={{ borderColor: "var(--border)" }}
            >
              <FaArrowLeft style={{ color: "var(--ink)" }} />
            </button>

            <div>
              <h1 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
                Interview History
              </h1>
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Track your past interviews and performance reports
              </p>
            </div>
          </div>

          {/* NEW (Feature: Weak-Topic Tracker + Leaderboard) */}
          {interviews.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate("/insights")}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white"
                style={{ backgroundColor: "var(--indigo)" }}
              >
                <HiSparkles size={15} />
                Topic Insights
              </button>
              <button
                onClick={() => navigate("/leaderboard")}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border bg-white"
                style={{ borderColor: "var(--border)", color: "var(--ink)" }}
              >
                <FaTrophy size={13} />
                Leaderboard
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: "#6B7280" }}>
            Loading your interviews...
          </p>
        ) : interviews.length === 0 ? (
          <div
            className="bg-white rounded-2xl border p-10 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No interviews found. Start your first interview!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {interviews.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(`/report/${item._id}`)}
                className="bg-white rounded-2xl border p-5 cursor-pointer hover:shadow-sm transition"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                      {item.role}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      {item.experience} · {item.mode}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-semibold text-lg" style={{ color: "var(--indigo)" }}>
                      {item.finalScore || 0}/10
                    </p>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>
                      Overall Score
                    </p>
                  </div>

                  {/* BUG FIX: className was built with a broken template
                      literal split across a stray backslash and comparing
                      item.status === "complete" (wrong value — schema
                      uses "completed"). Also both ternary branches were
                      empty strings, so the badge never showed any style. */}
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                    style={
                      item.status === "completed"
                        ? { backgroundColor: "rgba(30,138,95,0.12)", color: "var(--green)" }
                        : { backgroundColor: "rgba(232,163,61,0.15)", color: "var(--gold)" }
                    }
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewHistory;