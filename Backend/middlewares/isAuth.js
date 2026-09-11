// BUG FIX: "jwt" was used below but never imported. This would crash
// every authenticated request with "jwt is not defined".
import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        const token =
            req.cookies?.token ||
            req.headers.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return res.status(401).json({ message: "Authentication required: No token provided." });
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!verifyToken || !verifyToken.userId) {
            return res
                .status(401)
                .json({ message: "Invalid token payload. Please log in again." });
        }

        req.userId = verifyToken.userId;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Session expired or invalid. Please log in again." });
        }
        return res.status(500).json({ message: "Authentication failure: Internal server error." });
    }
};

export default isAuth;