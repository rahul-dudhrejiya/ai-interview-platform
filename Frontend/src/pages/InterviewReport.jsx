import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ServerUrl } from "../utils/constants";
import Step3Report from "../components/Step3Report";

const InterviewReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const result = await axios.get(
          ServerUrl + "/api/interview/report/" + id,
          { withCredentials: true }
        );

        setReport(result.data);
      } catch (err) {
        console.log(err);
        setError(err.response?.data?.message || "Failed to load interview report.");
      }
    };
    fetchReport();
  }, [id]);

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <p className="text-base font-semibold" style={{ color: "var(--red)" }}>
          {error}
        </p>
        <button
          onClick={() => navigate("/history")}
          className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          style={{ backgroundColor: "var(--indigo)" }}
        >
          Back to Interview History
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <p className="text-sm" style={{ color: "#6B7280" }}>
          Loading report...
        </p>
      </div>
    );
  }

  return <Step3Report report={report} />;
};

export default InterviewReport;