import { useEffect } from "react";
import Home from "./pages/Home";
import { Route, Routes } from "react-router-dom";
import Auth from "./pages/Auth";
import axios from "axios";
import { useDispatch } from "react-redux";
import { setUserData } from "./redux/userSlice";

import InterviewPage from "./pages/InterviewPage";
import InterviewHistory from "./pages/InterviewHistory";
import Pricing from "./pages/Pricing";
import InterviewReport from "./pages/InterviewReport";
import Insights from "./pages/Insights";
import Leaderboard from "./pages/Leaderboard";

// BUG FIX (found during deployment): if VITE_SERVER_URL is set with a
// trailing slash (e.g. "https://xxx.onrender.com/"), every API call in
// this app does `ServerUrl + "/api/..."`, producing a DOUBLE slash
// ("https://xxx.onrender.com//api/..."). Express 5's router doesn't
// treat that as the same path as the single-slash version, so every
// request 404s -- even though hitting the correct single-slash URL
// directly works fine. This is the exact same class of bug as the
// FRONTEND_URL/CORS trailing-slash issue on the backend - stripping it
// here means it doesn't matter how the env var is set on Vercel.
export const ServerUrl = (import.meta.env.VITE_SERVER_URL || "http://localhost:8000").replace(
  /\/+$/,
  ""
);

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const getUser = async () => {
      try {
        const result = await axios.get(ServerUrl + "/api/user/current-user", {
          withCredentials: true,
        });

        dispatch(setUserData(result.data.user));
      } catch (error) {
        console.log(error);
        dispatch(setUserData(null));
      }
    };
    getUser();
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/interview" element={<InterviewPage />} />
      <Route path="/history" element={<InterviewHistory />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/report/:id" element={<InterviewReport />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
  );
};

export default App;