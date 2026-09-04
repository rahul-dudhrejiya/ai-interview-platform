import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "motion/react";
import { FaArrowLeft } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
} from "recharts";
import { ServerUrl } from "../App";

const STATUS_STYLE = {
    weak: { color: "var(--red)", bg: "rgba(214,69,69,0.1)", label: "Needs Work" },
    moderate: { color: "var(--gold)", bg: "rgba(232,163,61,0.12)", label: "Improving" },
    strong: { color: "var(--green)", bg: "rgba(30,138,95,0.12)", label: "Strong" },
};

const Insights = () => {
    const navigate = useNavigate();
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const result = await axios.get(
                    ServerUrl + "/api/interview/weak-topics",
                    { withCredentials: true }
                );
                setTopics(result.data.topics || []);
            } catch (error) {
                console.log(error);
            } finally {
                setLoading(false);
            }
        };
        fetchTopics();
    }, []);

    const chartData = [...topics].reverse(); // weakest-first data looks better strongest-first on a bar chart
    const weakTopics = topics.filter((t) => t.status === "weak");

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--paper)" }}>
            <div className="max-w-4xl mx-auto">
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
                            Topic Insights
                        </h1>
                        <p className="text-sm" style={{ color: "#6B7280" }}>
                            Your performance broken down by subject, across all past interviews
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p className="text-sm text-center py-16" style={{ color: "#6B7280" }}>
                        Analyzing your interview history...
                    </p>
                ) : topics.length === 0 ? (
                    <div
                        className="bg-white rounded-2xl border p-10 text-center"
                        style={{ borderColor: "var(--border)" }}
                    >
                        <p className="text-sm" style={{ color: "#6B7280" }}>
                            No scored interviews yet. Complete a few interviews and check back here
                            to see which topics need more practice.
                        </p>
                    </div>
                ) : (
                    <>
                        {weakTopics.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl border p-5 mb-6 flex items-start gap-3"
                                style={{ borderColor: "rgba(214,69,69,0.25)", backgroundColor: "rgba(214,69,69,0.06)" }}
                            >
                                <HiSparkles size={18} style={{ color: "var(--red)" }} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
                                        Focus area{weakTopics.length > 1 ? "s" : ""} for your next study session
                                    </p>
                                    <p className="text-sm" style={{ color: "#4B5563" }}>
                                        You're consistently scoring lower on{" "}
                                        <strong>{weakTopics.map((t) => t.topic).join(", ")}</strong>. Try
                                        practicing a few more interviews focused on{" "}
                                        {weakTopics.length > 1 ? "these areas" : "this area"} before your
                                        next real interview.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl border p-6 mb-6"
                            style={{ borderColor: "var(--border)" }}
                        >
                            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>
                                Average Score by Topic
                            </h3>
                            <div style={{ height: `${Math.max(chartData.length * 42, 160)}px` }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                        <XAxis type="number" domain={[0, 10]} stroke="#9CA3AF" fontSize={12} />
                                        <YAxis
                                            type="category"
                                            dataKey="topic"
                                            width={140}
                                            stroke="#9CA3AF"
                                            fontSize={12}
                                        />
                                        <Tooltip
                                            formatter={(value) => [`${value}/10`, "Avg Score"]}
                                            contentStyle={{ borderRadius: 8, borderColor: "var(--border)" }}
                                        />
                                        <Bar dataKey="avgScore" radius={[0, 6, 6, 0]} barSize={20}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={index} fill={STATUS_STYLE[entry.status].color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        <div className="flex flex-col gap-3">
                            {topics.map((t, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white rounded-xl border p-4 flex items-center justify-between"
                                    style={{ borderColor: "var(--border)" }}
                                >
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                                            {t.topic}
                                        </p>
                                        <p className="text-xs" style={{ color: "#6B7280" }}>
                                            Based on {t.questionCount} question{t.questionCount !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                            style={{
                                                backgroundColor: STATUS_STYLE[t.status].bg,
                                                color: STATUS_STYLE[t.status].color,
                                            }}
                                        >
                                            {STATUS_STYLE[t.status].label}
                                        </span>
                                        <span
                                            className="font-mono font-semibold text-sm w-12 text-right"
                                            style={{ color: "var(--ink)" }}
                                        >
                                            {t.avgScore}/10
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Insights;