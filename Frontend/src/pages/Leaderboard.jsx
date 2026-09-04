import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { FaArrowLeft, FaTrophy, FaMedal } from "react-icons/fa";
import { ServerUrl } from "../App";

const RANK_STYLE = {
  1: { color: "#D4A017", bg: "rgba(212,160,23,0.12)" },
  2: { color: "#8C96A8", bg: "rgba(140,150,168,0.15)" },
  3: { color: "#C97A3D", bg: "rgba(201,122,61,0.12)" },
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [yourRank, setYourRank] = useState(null);
  const [totalRankedUsers, setTotalRankedUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const result = await axios.get(ServerUrl + "/api/interview/leaderboard", {
          withCredentials: true,
        });
        setLeaderboard(result.data.leaderboard || []);
        setYourRank(result.data.yourRank || null);
        setTotalRankedUsers(result.data.totalRankedUsers || 0);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/history")}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border"
            style={{ borderColor: "var(--border)" }}
          >
            <FaArrowLeft style={{ color: "var(--ink)" }} />
          </button>

          <div>
            <h1 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
              Leaderboard
            </h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Top performers, ranked by their best interview score
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: "#6B7280" }}>
            Loading rankings...
          </p>
        ) : leaderboard.length === 0 ? (
          <div
            className="bg-white rounded-2xl border p-10 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No completed interviews yet. Be the first to finish one and
              claim the top spot!
            </p>
          </div>
        ) : (
          <>
            {/* Your rank card — shown even if you're outside the top 10 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-5 mb-6"
              style={{ borderColor: "rgba(59,79,224,0.25)", backgroundColor: "rgba(59,79,224,0.06)" }}
            >
              {yourRank ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--indigo)" }}>
                      Your Standing
                    </p>
                    <p className="text-2xl font-mono font-bold" style={{ color: "var(--ink)" }}>
                      #{yourRank.rank}{" "}
                      <span className="text-sm font-normal" style={{ color: "#6B7280" }}>
                        of {totalRankedUsers}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-semibold" style={{ color: "var(--indigo)" }}>
                      {yourRank.bestScore}/10
                    </p>
                    <p className="text-xs" style={{ color: "#6B7280" }}>
                      Top {100 - yourRank.percentile}% of candidates
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--ink)" }}>
                  Complete an interview to see where you rank on the
                  leaderboard.
                </p>
              )}
            </motion.div>

            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => {
                const rankStyle = RANK_STYLE[entry.rank];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl border p-4 flex items-center justify-between"
                    style={{
                      borderColor: entry.isYou ? "var(--indigo)" : "var(--border)",
                      borderWidth: entry.isYou ? "2px" : "1px",
                      backgroundColor: entry.isYou ? "rgba(59,79,224,0.04)" : "var(--surface, #fff)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-semibold text-sm shrink-0"
                        style={{
                          backgroundColor: rankStyle ? rankStyle.bg : "var(--surface-muted)",
                          color: rankStyle ? rankStyle.color : "#6B7280",
                        }}
                      >
                        {entry.rank <= 3 ? (
                          entry.rank === 1 ? (
                            <FaTrophy size={14} />
                          ) : (
                            <FaMedal size={14} />
                          )
                        ) : (
                          entry.rank
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                        {entry.displayName}
                        {entry.isYou && (
                          <span
                            className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(59,79,224,0.12)", color: "var(--indigo)" }}
                          >
                            You
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="font-mono font-semibold text-sm" style={{ color: "var(--ink)" }}>
                      {entry.bestScore}/10
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;