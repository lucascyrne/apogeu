import { describe, expect, it } from "vitest";

import { degreeToScaleMidi, noteToMidi } from "./scale";

describe("pitch escala (notas discretas)", () => {
  it("graus adjacentes são notas da escala, sem lerp fraccionário", () => {
    const a = degreeToScaleMidi(2, "pentatonic", 0);
    const b = degreeToScaleMidi(3, "pentatonic", 0);
    expect(Number.isInteger(a)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
    expect(b).toBeGreaterThan(a);
    const c4 = noteToMidi("C4");
    const e5 = noteToMidi("E5");
    expect(a).toBeGreaterThanOrEqual(c4);
    expect(b).toBeLessThanOrEqual(e5);
  });

  it("oitava desloca o MIDI do grau", () => {
    const lo = degreeToScaleMidi(0, "pentatonic", 1);
    const base = degreeToScaleMidi(0, "pentatonic", 0);
    expect(lo - base).toBe(12);
  });
});
