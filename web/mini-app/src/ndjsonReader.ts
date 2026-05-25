import type { NdjsonEvent } from "./types";

/** Parse uma linha NDJSON; retorna null se inválida. */
export function parseNdjsonLine(line: string): NdjsonEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as NdjsonEvent;
  } catch {
    return null;
  }
}

/** Itera linhas de um blob de texto (arquivo gravado). */
export async function* iterateNdjson(
  text: string,
  delayMs = 33
): AsyncGenerator<NdjsonEvent> {
  for (const line of text.trim().split("\n")) {
    const ev = parseNdjsonLine(line);
    if (ev) yield ev;
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
