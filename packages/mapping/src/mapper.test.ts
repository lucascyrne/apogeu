import { describe, expect, it } from "vitest";

import { ExpressionEngine } from "./expression";
import { GestureMapper } from "./mapper";
import type { InstrumentConfig } from "./types";
import type { HandsSnapshot } from "./types";

const CONFIG: InstrumentConfig = {
  preset: "scale_gate",
  smoothingAlpha: 0.2,
  pitchAlpha: 0.15,
  spatialAlpha: 0.25,
  distanceAlpha: 0.22,
  deadZone: 0,
  scaleName: "pentatonic",
  scaleMode: "scale_notes",
  zoneRatio: 0.55,
  scaleHysteresis: 0.04,
  roleLeft: { pitchAxis: "y" },
  roleRight: { pitchAxis: "y" },
  gestureRoleRight: {
    gateOn: ["Open_Palm"],
    gateOff: ["Closed_Fist"],
    pitchHand: true,
  },
  gestureRoleLeft: { gateOn: [], gateOff: [] },
  pairVolume: { volumeDistMin: null, volumeDistMax: null },
  gestureTriggers: {},
};

function snap(leftY: number, rightY: number): HandsSnapshot {
  const lm = (rawX: number, rawY: number) =>
    Array.from({ length: 21 }, () => ({ x: rawX, y: rawY, z: 0 }));
  return {
    timestamp_ms: 1,
    left: {
      presence: true,
      gesture: "None",
      score: 0.9,
      handedness: "Left",
      landmarks: lm(0.25, 0.2 + (1 - leftY) * 0.5),
    },
    right: {
      presence: true,
      gesture: "Open_Palm",
      score: 0.9,
      handedness: "Right",
      landmarks: lm(0.75, 0.2 + (1 - rightY) * 0.5),
    },
  };
}

describe("GestureMapper", () => {
  it("edge lock mantém grau máximo quando norm salta para o meio", () => {
    const mapper = new GestureMapper(CONFIG);
    const expr = new ExpressionEngine({ pitchAlpha: 1, spatialAlpha: 1, distanceAlpha: 1 });

    for (let i = 0; i < 8; i++) {
      mapper.mapFrame(
        expr.process(snap(0.3, 1.8)),
        i * 33,
        "None",
        "Open_Palm",
        "Open_Palm"
      );
    }
    const high = mapper.mapFrame(
      expr.process(snap(0.3, 1.8)),
      300,
      "None",
      "Open_Palm",
      "Open_Palm"
    );
    const maxDeg = high.right.scale_degree ?? 0;
    expect(maxDeg).toBeGreaterThan(0);

    const jumped = mapper.mapFrame(
      expr.process(snap(0.3, 0.5)),
      333,
      "None",
      "Open_Palm",
      "Open_Palm"
    );
    expect(jumped.right.scale_degree).toBe(maxDeg);
  });

  it("emite pitch_midi discreto com gate aberto", () => {
    const expr = new ExpressionEngine({
      pitchAlpha: 0.5,
      spatialAlpha: 0.5,
      distanceAlpha: 0.5,
    });
    const mapper = new GestureMapper(CONFIG);
    let frame = null as ReturnType<GestureMapper["mapFrame"]> | null;

    for (let i = 0; i < 24; i++) {
      const smoothed = expr.process(snap(0.3, 0.4 + i * 0.008));
      frame = mapper.mapFrame(
        smoothed,
        i * 33,
        "None",
        "Open_Palm",
        "Open_Palm"
      );
    }

    expect(frame!.right.gate_open).toBe(true);
    expect(frame!.right.pitch_midi).not.toBeNull();
    expect(Number.isInteger(frame!.right.pitch_midi)).toBe(true);
    expect(frame!.right.spatial_x).toBeDefined();
    expect(frame!.right.spatial_y).toBeDefined();
  });
});
