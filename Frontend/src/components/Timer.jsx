import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const Timer = ({ timeLeft, totalTime }) => {
  // BUG FIX: original showed `${timeLeft}%` as the label text — a
  // countdown in seconds labeled with a "%" sign is confusing. It also
  // had no guard for totalTime being 0/undefined (division by 0 -> NaN%).
  const safeTotal = totalTime || 1;
  const percentage = (timeLeft / safeTotal) * 100;
  const isLow = totalTime ? timeLeft <= totalTime * 0.2 : false;

  return (
    <div className="w-24 h-24">
      <CircularProgressbar
        value={percentage}
        text={`${timeLeft}s`}
        styles={buildStyles({
          textSize: "22px",
          pathTransitionDuration: 0.5,
          pathColor: isLow ? "var(--red)" : "var(--indigo)",
          textColor: "var(--ink)",
          trailColor: "var(--border)",
        })}
      />
    </div>
  );
};

export default Timer;