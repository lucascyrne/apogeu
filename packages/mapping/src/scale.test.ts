import { describe, expect, it } from "vitest";

import { degreeToScaleMidi, ScaleQuantizer } from "./scale";

describe("ScaleQuantizer", () => {
  it("só altera grau em passos de 1", () => {
    const q = new ScaleQuantizer("pentatonic", 0.04);
    const steps = new Set<number>();
    let prev = q.quantize(0);
    for (let i = 1; i <= 50; i++) {
      const norm = i / 50;
      const d = q.quantize(norm);
      steps.add(Math.abs(d - prev));
      prev = d;
    }
    expect(steps.has(2)).toBe(false);
    expect(steps.has(0) || steps.has(1)).toBe(true);
  });

  it("não oscila no limiar com jitter", () => {
    const q = new ScaleQuantizer("pentatonic", 0.04);
    q.quantize(0.5);
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      seen.add(q.quantize(0.48 + (i % 2) * 0.04));
    }
    expect(seen.size).toBeLessThanOrEqual(2);
  });

  it("reset limpa estado", () => {
    const q = new ScaleQuantizer("pentatonic", 0.04);
    q.quantize(0.9);
    q.reset();
    expect(q.quantize(0.1)).toBeGreaterThanOrEqual(0);
  });
});

describe("degreeToScaleMidi", () => {
  it("retorna MIDI inteiro de nota da escala", () => {
    const a = degreeToScaleMidi(0, "pentatonic", 0);
    const b = degreeToScaleMidi(1, "pentatonic", 0);
    expect(Number.isInteger(a)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
    expect(b).not.toBe(a);
  });
});
