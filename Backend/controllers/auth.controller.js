import jwt from "jsonwebtoken";
import genToken from "../config/token.js";
import User from "../models/user.model.js";

export const googleAuth = async (req, res) => {
    try {
        const { name, email, idToken } = req.body;

        let verifiedEmail = email;
        let verifiedName = name;

        if (idToken) {
            try {
                // Decode Firebase Auth / Google ID token payload
                const decoded = jwt.decode(idToken);
                if (decoded && decoded.email) {
                    verifiedEmail = decoded.email;
                    verifiedName = decoded.name || name || "Candidate";
                }
            } catch (err) {
                console.warn("Could not decode idToken payload:", err.message);
            }
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

        const token = await genToken(user._id);

        const isProduction = process.env.NODE_ENV === "production";

        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Return user object along with the token for cross-domain Authorization header support
        return res.status(200).json({
            ...user.toObject(),
            token,
        });
    } catch (error) {
        console.error("Authentication error:", error);
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