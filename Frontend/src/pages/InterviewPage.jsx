import { useState } from "react";
import Step1SetUp from "../components/Step1SetUp";
import Step2Interview from "../components/Step2Interview";
import Step3Report from "../components/Step3Report";
// NEW (Feature: Coding Round Mode)
import CodingRound from "../components/CodingRound";

const InterviewPage = () => {
  const [step, setStep] = useState(1);
  const [interviewData, setInterviewData] = useState(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--paper)" }}>
      {step === 1 && (
        <Step1SetUp
          onStart={(data) => {
            setInterviewData(data);
            setStep(2);
          }}
        />
      )}

      {step === 2 &&
        // NEW: `mode` comes from the generateQuestion API response now.
        // "Coding" gets the Monaco editor experience, everything else
        // keeps the original voice-based interview flow untouched.
        (interviewData.mode === "Coding" ? (
          <CodingRound
            interviewData={interviewData}
            onFinish={(report) => {
              setInterviewData(report);
              setStep(3);
            }}
          />
        ) : (
          <Step2Interview
            interviewData={interviewData}
            onFinish={(report) => {
              setInterviewData(report);
              setStep(3);
            }}
          />
        ))}

      {step === 3 && <Step3Report report={interviewData} />}
    </div>
  );
};

export default InterviewPage;