import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ServerUrl } from "../App";
import Step3Report from "../components/Step3Report";

const InterviewReport = () => {
  const { id } = useParams();
  const [report, setReport] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const result = await axios.get(
          ServerUrl + "/api/interview/report/" + id,
          { withCredentials: true }
        );

        setReport(result.data);
      } catch (error) {
        console.log(error);
      }
    };
    fetchReport();
  }, [id]);

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