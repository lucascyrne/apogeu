import * as Tone from "tone";
import { midiToNoteName, scaleSize } from "@hand-gestures/mapping";
import type {
  ControlChangeEvent,
  ControlFrameEvent,
  GestureStableEvent,
} from "@hand-gestures/protocol";

import type { AudioEngine, EngineStatus } from "./types";

const FREQ_MIN = 180;
const FREQ_MAX = 880;
const DEFAULT_SCALE = "pentatonic";
const VOL_EPS = 0.02;
const PITCH_GLIDE_S = 0.04;
const VOL_GLIDE_S = 0.035;
const GATE_CLOSE_FRAMES = 5;
const REVERB_WET = 0.25;

const DEFAULT_STATUS: EngineStatus = {
  handsLabel: "Sem mãos",
  activeHand: null,
  leftOn: false,
  rightOn: false,
  effectiveVolume: 0,
  volumeActive: false,
  waitingForHands: true,
  lastFrame: null,
  gateOpen: false,
  currentNote: "—",
  scaleDegree: 0,
  scaleSize: scaleSize(DEFAULT_SCALE),
  scaleName: DEFAULT_SCALE,
  rightGesture: "—",
  playMode: "scale_gate",
};

function effectiveVolume(ev: ControlFrameEvent): number {
  const v = Math.max(0, Math.min(1, ev.pair.volume_master));
  return Math.pow(v, 0.88);
}

function midiToHz(midi: number): number {
  return Tone.Frequency(midi, "midi").toFrequency();
}

export class ToneScaleGateEngine implements AudioEngine {
  private synth: Tone.Synth | null = null;
  private audioStarted = false;
  private ready = false;
  private status: EngineStatus = { ...DEFAULT_STATUS };
  private lastNote = "—";
  private lastTrigger = 0;
  private sounding = false;
  private lastMidi: number | null = null;
  private lastVol = 0;
  private playMode = "scale_gate";
  private lastFrame: ControlFrameEvent | null = null;
  private gateClosedStreak = 0;

  async start(): Promise<void> {
    await Tone.start();
    const reverb = new Tone.Reverb({ decay: 2, wet: REVERB_WET }).toDestination();
    await reverb.generate();
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.03, decay: 0.1, sustain: 1, release: 0.4 },
      portamento: 0,
    }).connect(reverb);
    synth.volume.value = -8;
    this.synth = synth;
    this.audioStarted = true;
    this.ready = true;
    synth.triggerAttackRelease("A4", "16n");
    this.lastNote = "A4 (teste)";
  }

  dispose(): void {
    this.releaseSynth();
    this.synth?.dispose();
    this.synth = null;
    this.ready = false;
    this.audioStarted = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  getLastNote(): string {
    return this.lastNote;
  }

  applyFrame(ev: ControlFrameEvent): void {
    if (!this.synth || !this.audioStarted) return;

    const scale = ev.scale ?? DEFAULT_SCALE;

    const leftOn = ev.left.presence;
    const rightOn = ev.right.presence;
    const count = (leftOn ? 1 : 0) + (rightOn ? 1 : 0);
    const handsLabel =
      count === 0 ? "Sem mãos" : count === 1 ? "1 mão" : "2 mãos";
    const vol = effectiveVolume(ev);
    const mode = ev.preset === "theremin" ? "theremin" : "scale_gate";
    this.playMode = mode;

    const midi = ev.right.pitch_midi;
    const noteLabel =
      midi != null && ev.right.gate_open ? midiToNoteName(midi) : "—";
    const degree = ev.right.scale_degree ?? 0;

    this.lastFrame = ev;
    this.status = {
      handsLabel,
      activeHand: rightOn ? "Right" : leftOn ? "Left" : null,
      leftOn,
      rightOn,
      effectiveVolume: vol,
      volumeActive: Boolean(ev.pair.volume_active),
      waitingForHands: count === 0,
      lastFrame: ev,
      gateOpen: Boolean(ev.right.gate_open),
      currentNote: noteLabel,
      scaleDegree: degree,
      scaleSize: scaleSize(scale),
      scaleName: scale,
      rightGesture: ev.right.gesture ?? "—",
      playMode: mode,
    };

    if (mode === "theremin") this.handleTheremin(ev);
    else this.handleScaleGate(ev, vol);
  }

  onGestureStable(ev: GestureStableEvent): void {
    if (!this.synth || !this.audioStarted || ev.gesture === "None") return;
    const now = Date.now();
    if (now - this.lastTrigger < 150) return;
    this.lastTrigger = now;

    if (this.playMode !== "scale_gate") return;

    if (ev.gesture === "Thumb_Up" && ev.hand === "Left") {
      this.lastNote = "Oitava +";
      return;
    }
    if (ev.gesture === "Thumb_Down" && ev.hand === "Left") {
      this.lastNote = "Oitava −";
      return;
    }
    if (ev.gesture === "Pointing_Up" && ev.hand === "Right") {
      const frame = this.lastFrame;
      if (!frame?.right.gate_open || !this.sounding) return;
      const midi = frame.right.pitch_midi;
      if (midi == null) return;
      this.synth.frequency.rampTo(midiToHz(midi), 0.02);
      this.lastMidi = midi;
      this.lastNote = `${midiToNoteName(midi)} (acento)`;
    }
  }

  onControlChange(change: string): void {
    if (change === "octave_up" || change === "octave_down") {
      /* oitava no mapper via gestureAction no loop */
    }
  }

  handleLine(line: string): void {
    try {
      const ev = JSON.parse(line) as { type: string };
      if (ev.type === "control.frame") {
        this.applyFrame(ev as ControlFrameEvent);
      } else if (ev.type === "control.change") {
        this.onControlChange((ev as ControlChangeEvent).change);
      } else if (ev.type === "gesture.stable") {
        this.onGestureStable(ev as GestureStableEvent);
      }
    } catch {
      /* ignore */
    }
  }

  private releaseSynth(): void {
    if (this.synth && this.sounding) {
      this.synth.triggerRelease();
      this.sounding = false;
      this.lastMidi = null;
    }
  }

  private handleTheremin(ev: ControlFrameEvent): void {
    const synth = this.synth;
    if (!synth) return;

    const hand = ev.right.presence ? ev.right : ev.left;
    const vol = effectiveVolume(ev);

    if (!hand?.presence) {
      this.releaseSynth();
      return;
    }

    synth.volume.rampTo(Tone.gainToDb(vol), VOL_GLIDE_S);
    const freq = FREQ_MIN + hand.pitch_norm * (FREQ_MAX - FREQ_MIN);
    if (!this.sounding) {
      synth.triggerAttack(freq);
      this.sounding = true;
    } else {
      synth.frequency.rampTo(freq, PITCH_GLIDE_S);
    }
    this.lastNote = `${Math.round(freq)} Hz`;
  }

  private handleScaleGate(ev: ControlFrameEvent, vol: number): void {
    const synth = this.synth;
    if (!synth) return;

    const gate = ev.right.gate_open === true;
    const midi = ev.right.pitch_midi;

    if (!gate) {
      this.gateClosedStreak += 1;
      if (this.gateClosedStreak < GATE_CLOSE_FRAMES) return;
      this.releaseSynth();
      this.gateClosedStreak = 0;
      return;
    }
    this.gateClosedStreak = 0;

    if (midi == null) return;

    const volRamp = ev.pair.volume_active ? VOL_GLIDE_S : 0.05;
    if (Math.abs(vol - this.lastVol) > VOL_EPS) {
      synth.volume.rampTo(Tone.gainToDb(vol), volRamp);
      this.lastVol = vol;
    }

    const midiInt = Math.round(midi);
    const hz = midiToHz(midiInt);

    if (!this.sounding) {
      synth.triggerAttack(hz);
      this.sounding = true;
      this.lastMidi = midiInt;
    } else if (this.lastMidi == null || midiInt !== this.lastMidi) {
      synth.frequency.rampTo(hz, PITCH_GLIDE_S);
      this.lastMidi = midiInt;
    }

    this.lastNote = midiToNoteName(midiInt);
  }
}
