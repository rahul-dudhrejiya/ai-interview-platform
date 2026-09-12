import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDir = path.resolve("public");

// Ensure directory exists on boot and dynamically
const ensureUploadDir = () => {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
};
ensureUploadDir();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        ensureUploadDir();
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sanitize original filename (removes spaces, parentheses, special chars)
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filename = `${Date.now()}-${sanitized}`;
        cb(null, filename);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10mb limit
});