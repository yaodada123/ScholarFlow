import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
function toBoolean(value) {
    if (!value)
        return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
function toPositiveInt(value, fallback) {
    if (!value)
        return fallback;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
export function loadPdfOcrConfig() {
    return {
        enabled: toBoolean(process.env.PDF_OCR_ENABLED),
        lang: (process.env.PDF_OCR_LANG ?? "eng+chi_sim").trim() || "eng+chi_sim",
        maxPages: toPositiveInt(process.env.PDF_OCR_MAX_PAGES, 20),
        desiredWidth: toPositiveInt(process.env.PDF_OCR_DESIRED_WIDTH, 1600),
    };
}
export async function ocrPdf(filePath, config = loadPdfOcrConfig()) {
    let parser = null;
    try {
        const data = await readFile(filePath);
        parser = new PDFParse({ data });
        const screenshots = await parser.getScreenshot({
            first: config.maxPages,
            desiredWidth: config.desiredWidth,
            imageDataUrl: false,
            imageBuffer: true,
        });
        const texts = [];
        for (const page of screenshots.pages) {
            const result = await Tesseract.recognize(Buffer.from(page.data), config.lang);
            const text = result.data.text.trim();
            if (text)
                texts.push(text);
        }
        return {
            text: texts.join("\n\n"),
            pageCount: screenshots.total,
            pagesProcessed: screenshots.pages.length,
        };
    }
    finally {
        await parser?.destroy().catch(() => undefined);
    }
}
