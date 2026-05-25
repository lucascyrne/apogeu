export interface HandControl {
  presence: boolean;
  x: number;
  y: number;
  z: number;
  pan: number;
  pitch_norm: number;
  mod: number;
  gesture?: string | null;
  gate_open?: boolean;
  scale_degree?: number | null;
}

export interface ControlFrameEvent {
  schema_version: "2";
  type: "control.frame";
  timestamp_ms: number;
  preset: string;
  scale?: string;
  left: HandControl;
  right: HandControl;
  pair: {
    hands_distance: number;
    volume_master: number;
    spread: number;
    volume_active?: boolean;
  };
}

export interface GestureStableEvent {
  schema_version?: string;
  type: "gesture.stable";
  gesture: string;
  score: number;
  hand?: string | null;
  timestamp_ms: number;
}

export interface ControlChangeEvent {
  schema_version?: string;
  type: "control.change";
  timestamp_ms: number;
  change: string;
  value: string;
}

export type NdjsonEvent =
  | ControlFrameEvent
  | GestureStableEvent
  | ControlChangeEvent
  | { type: string };
