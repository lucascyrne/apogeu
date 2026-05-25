import type { NdjsonEvent } from "@hand-gestures/protocol";

export function parseNdjsonLine(line: string): NdjsonEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as NdjsonEvent;
  } catch {
    return null;
  }
}

export async function* iterateNdjson(
  text: string,
  delayMs = 33
): AsyncGenerator<NdjsonEvent> {
  for (const line of text.trim().split("\n")) {
    const ev = parseNdjsonLine(line);
    if (ev) yield ev;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}
