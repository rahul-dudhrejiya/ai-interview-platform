import genToken from "../config/token.js";
import User from "../models/user.model.js";

export const googleAuth = async (req, res) => {
    try {
        const { name, email } = req.body;
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                name,
                email,
            });
        }

        let token = await genToken(user._id);

        // BUG FIX (deployment): the old settings (secure: false,
        // sameSite: "strict") only work when frontend and backend are on
        // the SAME origin, like in local dev (both on localhost). In
        // production, the frontend (e.g. Vercel) and backend (e.g.
        // Render) live on DIFFERENT domains — that makes this a
        // cross-site cookie, which browsers block unless it's marked
        // `sameSite: "none"` AND `secure: true` (which itself requires
        // HTTPS - both Vercel and Render provide this by default). Without
        // this fix, login would appear to "succeed" (no error) but the
        // cookie would silently never be sent back on later requests,
        // so the user would look logged-out immediately after logging in.
        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: `Google auth Error: ${error}` });
    }
};

export const logout = async (req, res) => {
    try {
        const isProduction = process.env.NODE_ENV === "production";
        res.clearCookie("token", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });
        return res.status(200).json({ message: "Logout Successfully" });
    } catch (error) {
        return res.status(500).json({ message: `Logout Error: ${error}` });
    }
};