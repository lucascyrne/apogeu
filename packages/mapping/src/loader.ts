import { parse as parseYaml } from "yaml";
import type { InstrumentConfig } from "./types";

function section(data: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = data[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalFloat(value: unknown): number | null {
  if (value == null) return null;
  return Number(value);
}

const DEFAULT: InstrumentConfig = {
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

export function parseInstrumentYaml(text: string): InstrumentConfig {
  const data = (parseYaml(text) as Record<string, unknown>) ?? {};
  const smoothing = section(data, "smoothing");
  const roles = section(data, "roles");
  const gestureRoles = section(data, "gesture_roles");
  const scaleData = section(data, "scale");
  const pairData = section(data, "pair");
  const gr = section(gestureRoles, "right");
  const gl = section(gestureRoles, "left");
  const roleL = section(roles, "left");
  const roleR = section(roles, "right");

  return {
    preset: String(data.preset ?? DEFAULT.preset),
    smoothingAlpha: Number(smoothing.alpha ?? DEFAULT.smoothingAlpha),
    pitchAlpha: Number(smoothing.pitch_alpha ?? DEFAULT.pitchAlpha),
    spatialAlpha: Number(smoothing.spatial_alpha ?? DEFAULT.spatialAlpha),
    distanceAlpha: Number(smoothing.distance_alpha ?? DEFAULT.distanceAlpha),
    deadZone: Number(smoothing.dead_zone ?? DEFAULT.deadZone),
    scaleName: String(scaleData.name ?? DEFAULT.scaleName),
    scaleMode: (() => {
      const mode = String(scaleData.mode ?? DEFAULT.scaleMode);
      if (mode === "zones") return "zones" as const;
      if (mode === "scale_glide") return "scale_notes" as const;
      return "scale_notes" as const;
    })(),
    zoneRatio: Number(scaleData.zone_ratio ?? DEFAULT.zoneRatio),
    scaleHysteresis: Number(scaleData.hysteresis ?? DEFAULT.scaleHysteresis),
    roleLeft: { pitchAxis: String(roleL.pitch_axis ?? "y") },
    roleRight: { pitchAxis: String(roleR.pitch_axis ?? "y") },
    gestureRoleRight: {
      gateOn: (gr.gate_on as string[]) ?? DEFAULT.gestureRoleRight.gateOn,
      gateOff: (gr.gate_off as string[]) ?? DEFAULT.gestureRoleRight.gateOff,
      pitchHand: Boolean(gr.pitch_hand ?? true),
    },
    gestureRoleLeft: {
      gateOn: (gl.gate_on as string[]) ?? [],
      gateOff: (gl.gate_off as string[]) ?? [],
    },
    pairVolume: {
      volumeDistMin: optionalFloat(pairData.volume_dist_min),
      volumeDistMax: optionalFloat(pairData.volume_dist_max),
    },
    gestureTriggers: (data.gesture_triggers as InstrumentConfig["gestureTriggers"]) ?? {},
  };
}

export async function loadInstrumentConfig(url: string): Promise<InstrumentConfig> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  return parseInstrumentYaml(await res.text());
}
