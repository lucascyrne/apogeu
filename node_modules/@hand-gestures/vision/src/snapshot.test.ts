import { describe, expect, it } from "vitest";

import type { HandState } from "@hand-gestures/mapping";

import { assignHandSlots } from "./snapshot";

function hand(x: number, label: "Left" | "Right"): HandState {
  return {
    presence: true,
    gesture: "Open_Palm",
    score: 0.9,
    handedness: label,
    landmarks: [{ x, y: 0.5, z: 0 }],
  };
}

describe("assignHandSlots por handedness", () => {
  it("MediaPipe Left → slot left independente do X", () => {
    const { left, right } = assignHandSlots(
      [hand(0.8, "Left"), hand(0.2, "Right")],
      []
    );
    expect(left.handedness).toBe("Left");
    expect(right.handedness).toBe("Right");
    expect(left.landmarks![0].x).toBeCloseTo(0.8);
    expect(right.landmarks![0].x).toBeCloseTo(0.2);
  });

  it("mão única Right → slot right", () => {
    const { left, right } = assignHandSlots([hand(0.3, "Right")], []);
    expect(left.presence).toBe(false);
    expect(right.presence).toBe(true);
    expect(right.handedness).toBe("Right");
  });
});
