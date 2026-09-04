// BUG FIX: "jwt" was used below but never imported. This would crash
// every authenticated request with "jwt is not defined".
import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        // BUG FIX: cookie-parser attaches cookies as `req.cookies` (plural),
        // not `req.cookie`. `req.cookie` is always undefined, so token was
        // always undefined and every request "successfully" failed auth.
        const { token } = req.cookies;

        if (!token) {
            return res.status(400).json({ message: "User does not have token" });
        }

        const verifyToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!verifyToken) {
            return res
                .status(400)
                .json({ message: "User does not have a valid token" });
        }

        req.userId = verifyToken.userId;

        next();
    } catch (error) {
        return res.status(500).json({ message: `Internal server error ${error}` });
    }
};

export default isAuth;