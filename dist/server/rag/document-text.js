import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
export const ragDir = path.resolve(process.cwd(), "data", "rag");
export class RagTextExtractionError extends Error {
    constructor(message) {
        super(message);
        this.name = "RagTextExtractionError";
    }
}
export function sanitizeRagFilename(input) {
    const base = path.basename(input ?? "").replaceAll("\0", "");
    const cleaned = base.replaceAll(/[\\/]/g, "_").trim();
    if (!cleaned)
        return "upload.txt";
    return cleaned.slice(0, 200);
}
export function isAllowedRagFilename(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ext === ".md" || ext === ".txt" || ext === ".pdf";
}
export function buildLocalResource(filename) {
    const safeName = sanitizeRagFilename(filename);
    return { uri: `rag://local/${safeName}`, title: safeName, description: "" };
}
export function localFilenameFromUri(uri) {
    if (!uri.startsWith("rag://local/"))
        return null;
    const withoutFragment = uri.slice("rag://local/".length).split(/[?#]/, 1)[0] ?? "";
    const decoded = (() => {
        try {
            return decodeURIComponent(withoutFragment);
        }
        catch {
            return withoutFragment;
        }
    })();
    const filename = sanitizeRagFilename(decoded);
    if (!isAllowedRagFilename(filename))
        return null;
    return filename;
}
function normalizeExtractedText(text) {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
async function extractPdfText(filePath) {
    let parser = null;
    try {
        const data = await readFile(filePath);
        parser = new PDFParse({ data });
        const result = await parser.getText();
        return { text: normalizeExtractedText(result.text), pageCount: result.total };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new RagTextExtractionError(`Failed to extract text from PDF: ${message}`);
    }
    finally {
        await parser?.destroy().catch(() => undefined);
    }
}
export async function extractTextFromRagFile(filePath, filename) {
    const safeName = sanitizeRagFilename(filename);
    const ext = path.extname(safeName).toLowerCase();
    if (ext === ".md" || ext === ".txt") {
        const content = await readFile(filePath, { encoding: "utf8" });
        const text = normalizeExtractedText(content);
        if (!text)
            throw new RagTextExtractionError("Could not extract text from the uploaded file.");
        return { text, sourceType: "text" };
    }
    if (ext === ".pdf") {
        const result = await extractPdfText(filePath);
        if (!result.text) {
            throw new RagTextExtractionError("Could not extract selectable text from PDF. Scanned/image-only PDFs are not supported.");
        }
        return { text: result.text, sourceType: "pdf", ...(result.pageCount != null ? { pageCount: result.pageCount } : {}) };
    }
    throw new RagTextExtractionError("Only .md, .txt, and text-based .pdf files are supported.");
}
