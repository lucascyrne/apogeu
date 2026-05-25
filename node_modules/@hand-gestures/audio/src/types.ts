import type { ControlFrameEvent } from "@hand-gestures/protocol";

export type EngineStatus = {
  handsLabel: string;
  activeHand: "Left" | "Right" | null;
  leftOn: boolean;
  rightOn: boolean;
  effectiveVolume: number;
  volumeActive: boolean;
  waitingForHands: boolean;
  lastFrame: ControlFrameEvent | null;
  gateOpen: boolean;
  currentNote: string;
  scaleDegree: number;
  scaleSize: number;
  scaleName: string;
  rightGesture: string;
  playMode: string;
};

export type AudioEngine = {
  start(): Promise<void>;
  dispose(): void;
  applyFrame(ev: ControlFrameEvent): void;
  handleLine(line: string): void;
  onGestureStable(ev: {
    gesture: string;
    hand?: string | null;
  }): void;
  onControlChange(change: string): void;
  getStatus(): EngineStatus;
  getLastNote(): string;
  isReady(): boolean;
};
