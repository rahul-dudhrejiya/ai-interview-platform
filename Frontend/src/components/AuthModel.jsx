import { useEffect } from "react";
import { useSelector } from "react-redux";
import { FaTimes } from "react-icons/fa";
// BUG FIX: <Auth /> was rendered below but never imported.
import Auth from "../pages/Auth";

const AuthModel = ({ onClose }) => {
  const { userData } = useSelector((state) => state.user);

  useEffect(() => {
    if (userData) {
      onClose();
    }
  }, [userData, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div
        className="relative rounded-2xl shadow-xl p-2 max-w-sm w-full"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white z-10"
          style={{ backgroundColor: "var(--emphasis)" }}
        >
          <FaTimes size={13} />
        </button>
        <Auth isModel={true} />
      </div>
    </div>
  );
};

export default AuthModel;