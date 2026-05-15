export type RagChunk = {
  index: number;
  text: string;
};

function splitLongText(text: string, chunkSize: number, overlap: number): string[] {
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return out;
}

function overlapTail(text: string, overlap: number): string {
  if (overlap <= 0 || text.length <= overlap) return overlap > 0 ? text : "";
  return text.slice(text.length - overlap).trim();
}

export function chunkText(params: { text: string; chunkSize: number; chunkOverlap: number }): RagChunk[] {
  const chunkSize = Math.max(1, params.chunkSize);
  const chunkOverlap = Math.max(0, Math.min(params.chunkOverlap, chunkSize - 1));
  const normalized = params.text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      chunks.push(...splitLongText(paragraph, chunkSize, chunkOverlap));
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    if (current.trim()) chunks.push(current.trim());
    const tail = overlapTail(current, chunkOverlap);
    current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    if (current.length > chunkSize) {
      chunks.push(...splitLongText(current, chunkSize, chunkOverlap));
      current = "";
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks
    .map((text, index) => ({ index, text }))
    .filter((chunk) => chunk.text.trim().length > 0);
}
