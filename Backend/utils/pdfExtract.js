import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// BUG FIX (found during testing on Windows — round 2): pdf.js needs a
// proper URL pointing at its bundled "standard fonts" folder, or every
// PDF parse fails/warns. The first attempt at this manually converted
// backslashes to forward slashes and appended a trailing "/" — that
// mostly worked, but broke again on a real-world path like
// "C:\Users\DELL\...\AI Interview project\..." because the folder name
// contains a SPACE, and manual string replacement doesn't percent-encode
// that space the way a real URL requires. pdf.js's URL parser then
// rejected the path as invalid.
//
// The robust fix: use Node's own `pathToFileURL()` (from the built-in
// "url" module) instead of hand-rolling the conversion. It's designed
// exactly for this — turning any OS file path (Windows drive letters,
// backslashes, spaces, unicode, anything) into a correctly-escaped
// file:// URL. This removes the entire class of "what if the path has
// a weird character" bugs, on any OS, permanently.
const fontsDir = path.join(
    __dirname,
    "..",
    "node_modules",
    "pdfjs-dist",
    "standard_fonts"
);
const hasFonts = fs.existsSync(fontsDir);
const STANDARD_FONT_DATA_URL = hasFonts ? pathToFileURL(fontsDir).href + "/" : undefined;

export const extractTextFromPDF = async (filepath) => {
    const fileBuffer = await fs.promises.readFile(filepath);
    const uint8Array = new Uint8Array(fileBuffer);

    const docParams = {
        data: uint8Array,
    };
    if (STANDARD_FONT_DATA_URL) {
        docParams.standardFontDataUrl = STANDARD_FONT_DATA_URL;
    }

    const pdf = await pdfjsLib.getDocument(docParams).promise;

    let text = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item) => (item && typeof item.str === "string" ? item.str : ""))
            .join(" ");
        text += pageText + "\n";
    }

    return text.replace(/\s+/g, " ").trim();
};