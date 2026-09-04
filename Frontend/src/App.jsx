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

// NEW (deployment): hardcoding "http://localhost:8000" here meant the
// deployed frontend would always try to talk to your own laptop, which
// obviously isn't reachable once deployed. Vite exposes any env variable
// prefixed with VITE_ via import.meta.env - set VITE_SERVER_URL in a
// .env file locally (http://localhost:8000) and in Vercel's project
// settings (your real Render backend URL) so the same built code works
// in both places.
export const ServerUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

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