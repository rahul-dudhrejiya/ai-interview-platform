import axios from "axios";
import genToken from "../config/token.js";
import User from "../models/user.model.js";

export const googleAuth = async (req, res) => {
    try {
        const { name, email, idToken } = req.body;

        let verifiedEmail = email;
        let verifiedName = name;

        if (idToken) {
            try {
                // Cryptographically verify Google idToken via Google's tokeninfo endpoint
                const tokenRes = await axios.get(
                    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
                    { timeout: 10000 }
                );
                if (tokenRes.data && tokenRes.data.email) {
                    verifiedEmail = tokenRes.data.email;
                    verifiedName = tokenRes.data.name || name || "Candidate";
                } else {
                    return res.status(401).json({ message: "Invalid Google ID token." });
                }
            } catch (err) {
                console.error("Google ID Token verification failed:", err.message);
                return res.status(401).json({ message: "Failed to verify Google credentials." });
            }
        } else if (process.env.NODE_ENV === "production") {
            return res.status(401).json({ message: "Google ID token is required." });
        }

        if (!verifiedEmail) {
            return res.status(400).json({ message: "Valid email is required." });
        }

        let user = await User.findOne({ email: verifiedEmail });

        if (!user) {
            user = await User.create({
                name: verifiedName || "User",
                email: verifiedEmail,
            });
        }

        let token = await genToken(user._id);

        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: "Authentication failed: Internal server error." });
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