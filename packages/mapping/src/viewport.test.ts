import { describe, expect, it } from "vitest";

import { pitchNormFromCameraPoint, ROI_MARGIN } from "./viewport";

describe("pitchNormFromCameraPoint", () => {
  it("platô acima da ROI → pitch 1", () => {
    expect(pitchNormFromCameraPoint(0.5, ROI_MARGIN - 0.05, "y")).toBe(1);
  });

  it("platô abaixo da ROI → pitch 0", () => {
    const hi = 1 - ROI_MARGIN;
    expect(pitchNormFromCameraPoint(0.5, hi + 0.05, "y")).toBe(0);
  });

  it("dentro da ROI mapeia Y invertido", () => {
    const mid = 0.5;
    const v = pitchNormFromCameraPoint(mid, mid, "y");
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.8);
  });
});
