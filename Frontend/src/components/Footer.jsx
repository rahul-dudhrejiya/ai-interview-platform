import { BsRobot } from "react-icons/bs";

const Footer = () => {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="w-full max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: "var(--emphasis)" }}
          >
            <BsRobot size={16} />
          </div>
          <h2 className="font-display font-semibold" style={{ color: "var(--ink)" }}>
            InterviewIQ.AI
          </h2>
        </div>
        <p className="text-sm max-w-sm" style={{ color: "#6B7280" }}>
          AI-powered interview preparation platform designed to improve
          communication, confidence, and interview readiness.
        </p>
        <p className="text-xs" style={{ color: "#9CA3AF" }}>
          © {new Date().getFullYear()} InterviewIQ.AI
        </p>
      </div>
    </footer>
  );
};

export default Footer;