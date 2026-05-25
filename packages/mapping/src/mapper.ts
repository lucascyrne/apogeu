import type { ControlFrameEvent, HandControl } from "@hand-gestures/protocol";
import { DistanceCalibrator } from "./distance";
import type { SmoothedFrame, SmoothedHandFeatures } from "./expression";
import { GateLatch } from "./gateLatch";
import { PresenceHold } from "./presence";
import {
  degreeToScaleMidi,
  scaleSize,
  ScaleQuantizer,
} from "./scale";
import type { InstrumentConfig } from "./types";

const DEFAULT_VOLUME = 0.75;
const VICTORY = "Victory";
const EDGE = 0.02;
const RELEASE_LOW = 0.06;
const GATE_RESET_FRAMES = 5;

function axisValue(hand: SmoothedHandFeatures, axis: string): number {
  if (axis === "x") return hand.x_norm;
  if (axis === "z") return hand.z_norm;
  return hand.y_norm;
}

export class GestureMapper {
  private octaveShift = 0;
  private lastVolume = DEFAULT_VOLUME;
  private lastPitchMidi: number | null = null;
  private lastHandsDistance = 0;
  private rightGate: GateLatch;
  private rightPresence = new PresenceHold(8);
  private victoryHold = new PresenceHold(3);
  private distance: DistanceCalibrator;
  private pitchQuantizer: ScaleQuantizer;
  private edgeLock: "low" | "high" | null = null;
  private lastPublishedDegree: number | null = null;
  private gateClosedFrames = 0;

  constructor(private config: InstrumentConfig) {
    this.rightGate = GateLatch.fromLists(
      config.gestureRoleRight.gateOn,
      config.gestureRoleRight.gateOff
    );
    this.distance = new DistanceCalibrator(
      config.pairVolume.volumeDistMin,
      config.pairVolume.volumeDistMax
    );
    this.pitchQuantizer = new ScaleQuantizer(
      config.scaleName,
      config.scaleHysteresis
    );
  }

  get preset(): string {
    return this.config.preset;
  }

  get scaleName(): string {
    return this.config.scaleName;
  }

  applyOctaveShift(delta: number): void {
    this.octaveShift = Math.max(-2, Math.min(2, this.octaveShift + delta));
  }

  mapFrame(
    smoothed: SmoothedFrame,
    timestampMs: number,
    leftGesture: string,
    rightGesture: string,
    rightGestureStable: string
  ): ControlFrameEvent {
    const right = this.mapPitchHand(
      smoothed.right,
      rightGesture,
      rightGestureStable
    );
    const left = this.mapHand(
      smoothed.left,
      this.config.roleLeft.pitchAxis,
      leftGesture
    );

    const gateOpen = right.gate_open === true;
    const volActive = this.victoryHold.update(rightGesture === VICTORY);
    const vol = this.volumeForPair(smoothed, gateOpen, volActive, timestampMs);

    return {
      schema_version: "2",
      type: "control.frame",
      timestamp_ms: timestampMs,
      preset: this.preset,
      scale: this.scaleName,
      left,
      right,
      pair: {
        hands_distance: smoothed.hands_distance,
        volume_master: vol,
        spread: smoothed.spread,
        volume_active: volActive,
      },
    };
  }

  private volumeForPair(
    smoothed: SmoothedFrame,
    gateOpen: boolean,
    volActive: boolean,
    timestampMs: number
  ): number {
    if (!gateOpen) return 0;
    if (!volActive) return this.lastVolume;

    const dist =
      smoothed.left.presence && smoothed.right.presence
        ? smoothed.hands_distance
        : this.lastHandsDistance;

    if (smoothed.left.presence && smoothed.right.presence) {
      this.lastHandsDistance = smoothed.hands_distance;
    }

    const vol = this.distance.map(dist, true, timestampMs);
    this.lastVolume = vol;
    return vol;
  }

  private mapPitchHand(
    hand: SmoothedHandFeatures,
    gesture: string,
    gateGestureStable: string
  ): HandControl {
    const pitchAxis = this.config.roleRight.pitchAxis;
    const pitchNorm = axisValue(hand, pitchAxis);

    const gate = this.rightGate.update(
      gesture,
      hand.presence,
      gateGestureStable
    );

    let presence = hand.presence;
    if (this.preset === "scale_gate") {
      presence = gate ? true : this.rightPresence.update(hand.presence);
    }

    let pitchMidi: number | null = null;
    let degree: number | null = null;

    if (this.preset === "scale_gate") {
      if (!gate) {
        this.gateClosedFrames += 1;
        if (this.gateClosedFrames >= GATE_RESET_FRAMES) {
          this.pitchQuantizer.reset();
          this.edgeLock = null;
          this.lastPublishedDegree = null;
        }
      } else {
        this.gateClosedFrames = 0;
      }
    }

    if (this.preset === "scale_gate" && (presence || gate)) {
      if (gate) {
        degree = this.resolvePitchDegree(pitchNorm);
        this.pitchQuantizer.syncDegree(degree);
        pitchMidi = degreeToScaleMidi(degree, this.scaleName, this.octaveShift);
        this.lastPitchMidi = pitchMidi;
        this.lastPublishedDegree = degree;
      } else if (this.lastPitchMidi != null) {
        pitchMidi = this.lastPitchMidi;
        degree = this.lastPublishedDegree;
      }
    }

    return {
      presence: presence || gate,
      x: hand.spatial_x,
      y: hand.spatial_y,
      z: hand.z_norm,
      pan: 0,
      pitch_norm: pitchNorm,
      mod: 0,
      gesture: gesture !== "None" ? gesture : null,
      gate_open: gate,
      scale_degree: degree,
      spatial_x: hand.spatial_x,
      spatial_y: hand.spatial_y,
      pitch_midi: gate ? pitchMidi : null,
    };
  }

  private mapHand(
    hand: SmoothedHandFeatures,
    pitchAxis: string,
    gesture: string
  ): HandControl {
    const pitchNorm = axisValue(hand, pitchAxis);
    return {
      presence: hand.presence,
      x: hand.spatial_x,
      y: hand.spatial_y,
      z: hand.z_norm,
      pan: 0,
      pitch_norm: pitchNorm,
      mod: 0,
      gesture: gesture !== "None" ? gesture : null,
      gate_open: false,
      scale_degree: null,
      spatial_x: hand.spatial_x,
      spatial_y: hand.spatial_y,
      pitch_midi: null,
    };
  }

  private resolvePitchDegree(pitchNorm: number): number {
    const n = scaleSize(this.scaleName);
    const maxDeg = Math.max(0, n - 1);
    const releaseHigh = maxDeg > 1 ? 0.5 - EDGE : 1 - EDGE;

    if (pitchNorm <= EDGE) {
      this.edgeLock = "low";
    } else if (this.edgeLock === "low" && pitchNorm > RELEASE_LOW) {
      this.edgeLock = null;
    }

    if (pitchNorm >= 1 - EDGE) {
      this.edgeLock = "high";
    } else if (this.edgeLock === "high" && pitchNorm < releaseHigh) {
      this.edgeLock = null;
    }

    if (this.edgeLock === "low") {
      return 0;
    }
    if (this.edgeLock === "high") {
      return maxDeg;
    }

    return this.pitchQuantizer.quantize(pitchNorm);
  }

  gestureAction(gesture: string, hand: string | null): { action?: string; hand?: string } | null {
    const trigger = this.config.gestureTriggers[gesture];
    if (!trigger) return null;
    const th = (trigger.hand ?? "any").toLowerCase();
    if (th !== "any" && hand && th !== hand.toLowerCase()) return null;
    return trigger;
  }
}
