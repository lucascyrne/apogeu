import { describe, expect, it } from "vitest";

import { extractRawFeatures } from "./features";
import type { HandsSnapshot } from "./types";

function snapAt(lx: number, ly: number, rx: number, ry: number): HandsSnapshot {
  const lm = (x: number, y: number) =>
    Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  return {
    timestamp_ms: 1,
    left: {
      presence: true,
      gesture: null,
      score: 0.9,
      handedness: "Left",
      landmarks: lm(lx, ly),
    },
    right: {
      presence: true,
      gesture: null,
      score: 0.9,
      handedness: "Right",
      landmarks: lm(rx, ry),
    },
  };
}

describe("hands_distance e ROI", () => {
  it("punhos coincidentes na ROI → distância ~0", () => {
    const raw = extractRawFeatures(snapAt(0.4, 0.5, 0.4, 0.5));
    expect(raw.hands_distance).toBeLessThan(0.05);
  });

  it("punho fora da ROI mantém presence com clamp", () => {
    const raw = extractRawFeatures(snapAt(0.05, 0.5, 0.75, 0.5));
    expect(raw.left.presence).toBe(true);
    expect(raw.left.in_roi).toBe(false);
    expect(raw.left.spatial_x).toBeGreaterThanOrEqual(0);
    expect(raw.left.spatial_x).toBeLessThanOrEqual(1);
  });
});
