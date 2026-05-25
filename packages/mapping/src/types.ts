import type { ControlFrameEvent } from "@hand-gestures/protocol";

export type Landmark = { x: number; y: number; z: number };

export type HandState = {
  gesture: string | null;
  score: number;
  handedness: string;
  landmarks: Landmark[] | null;
  presence: boolean;
};

export type HandsSnapshot = {
  left: HandState;
  right: HandState;
  timestamp_ms: number;
};

export type InstrumentConfig = {
  preset: string;
  smoothingAlpha: number;
  pitchAlpha: number;
  spatialAlpha: number;
  distanceAlpha: number;
  deadZone: number;
  scaleName: string;
  scaleMode: "scale_notes" | "scale_glide" | "zones";
  zoneRatio: number;
  scaleHysteresis: number;
  roleLeft: { pitchAxis: string };
  roleRight: { pitchAxis: string };
  gestureRoleRight: {
    gateOn: string[];
    gateOff: string[];
    pitchHand: boolean;
  };
  gestureRoleLeft: {
    gateOn: string[];
    gateOff: string[];
  };
  pairVolume: {
    volumeDistMin: number | null;
    volumeDistMax: number | null;
  };
  gestureTriggers: Record<string, { action?: string; hand?: string }>;
};

export type { ControlFrameEvent };
