import { useCallback, useRef, useState } from "react";

import * as Tone from "tone";

import { noteAtDegree, scaleSize } from "./scale";

import type {

  ControlChangeEvent,

  ControlFrameEvent,

  GestureStableEvent,

} from "./types";



const FREQ_MIN = 180;

const FREQ_MAX = 880;

const DEFAULT_SCALE = "pentatonic";

const VOL_EPS = 0.02;

const NOTE_GLIDE_S = 0.07;

const GATE_CLOSE_FRAMES = 5;

const REVERB_WET = 0.25;



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

  return Math.max(0, Math.min(1, ev.pair.volume_master));

}



function freqFromNorm(norm: number): number {

  return FREQ_MIN + norm * (FREQ_MAX - FREQ_MIN);

}



export function useToneEngine() {

  const [ready, setReady] = useState(false);

  const [lastNote, setLastNote] = useState("—");

  const [status, setStatus] = useState<EngineStatus>(DEFAULT_STATUS);

  const synthRef = useRef<Tone.Synth | null>(null);

  const reverbRef = useRef<Tone.Reverb | null>(null);

  const audioStartedRef = useRef(false);

  const lastTriggerRef = useRef(0);

  const soundingRef = useRef(false);

  const currentDegreeRef = useRef<number | null>(null);

  const lastPlayedNoteRef = useRef<string | null>(null);

  const lastVolRef = useRef(0);

  const octaveShiftRef = useRef(0);

  const playModeRef = useRef("scale_gate");

  const scaleNameRef = useRef(DEFAULT_SCALE);

  const lastFrameRef = useRef<ControlFrameEvent | null>(null);

  const gateClosedStreakRef = useRef(0);



  const start = useCallback(async () => {

    await Tone.start();

    const reverb = new Tone.Reverb({ decay: 2, wet: REVERB_WET }).toDestination();

    await reverb.generate();

    const synth = new Tone.Synth({

      oscillator: { type: "sine" },

      envelope: { attack: 0.03, decay: 0.1, sustain: 1, release: 0.4 },

    }).connect(reverb);

    synth.volume.value = -8;

    synthRef.current = synth;

    reverbRef.current = reverb;

    audioStartedRef.current = true;

    setReady(true);

    synth.triggerAttackRelease("A4", "16n");

    setLastNote("A4 (teste)");

  }, []);



  const releaseSynth = useCallback(() => {

    const synth = synthRef.current;

    if (synth && soundingRef.current) {

      synth.triggerRelease();

      soundingRef.current = false;

      currentDegreeRef.current = null;

      lastPlayedNoteRef.current = null;

    }

  }, []);



  const playNote = useCallback((note: string, vol: number) => {

    const synth = synthRef.current;

    if (!synth) return;



    if (Math.abs(vol - lastVolRef.current) > VOL_EPS) {

      synth.volume.rampTo(Tone.gainToDb(vol), 0.05);

      lastVolRef.current = vol;

    }



    if (!soundingRef.current) {

      synth.triggerAttack(note);

      soundingRef.current = true;

      lastPlayedNoteRef.current = note;

    } else if (note !== lastPlayedNoteRef.current) {

      synth.frequency.rampTo(

        Tone.Frequency(note).toFrequency(),

        NOTE_GLIDE_S

      );

      lastPlayedNoteRef.current = note;

    }



    setLastNote(note);

  }, []);



  const handleTheremin = useCallback((ev: ControlFrameEvent) => {

    const synth = synthRef.current;

    if (!synth) return;



    const hand = ev.right.presence ? ev.right : ev.left;

    const vol = effectiveVolume(ev);



    if (!hand?.presence) {

      releaseSynth();

      return;

    }



    synth.volume.rampTo(Tone.gainToDb(vol), 0.05);

    const freq = freqFromNorm(hand.pitch_norm);

    if (!soundingRef.current) {

      synth.triggerAttack(freq);

      soundingRef.current = true;

    } else {

      synth.frequency.rampTo(freq, 0.05);

    }

    setLastNote(`${Math.round(freq)} Hz`);

  }, [releaseSynth]);



  const handleScaleGate = useCallback(

    (ev: ControlFrameEvent) => {

      const right = ev.right;

      const vol = effectiveVolume(ev);

      const scale = ev.scale ?? scaleNameRef.current;

      const degree =

        right.scale_degree ?? currentDegreeRef.current ?? 0;

      const note = noteAtDegree(scale, degree, octaveShiftRef.current);

      const gate = right.gate_open === true;



      if (!gate) {

        gateClosedStreakRef.current += 1;

        if (gateClosedStreakRef.current < GATE_CLOSE_FRAMES) {

          return;

        }

        releaseSynth();

        gateClosedStreakRef.current = 0;

        return;

      }

      gateClosedStreakRef.current = 0;



      if (degree !== currentDegreeRef.current) {

        currentDegreeRef.current = degree;

      }



      playNote(note, vol);

    },

    [releaseSynth, playNote]

  );



  const handleControlFrame = useCallback(

    (ev: ControlFrameEvent) => {

      const synth = synthRef.current;

      if (!synth || !audioStartedRef.current) return;



      const scale = ev.scale ?? DEFAULT_SCALE;

      scaleNameRef.current = scale;



      const leftOn = ev.left.presence;

      const rightOn = ev.right.presence;

      const count = (leftOn ? 1 : 0) + (rightOn ? 1 : 0);

      const handsLabel =

        count === 0 ? "Sem mãos" : count === 1 ? "1 mão" : "2 mãos";

      const vol = effectiveVolume(ev);

      const mode = ev.preset === "theremin" ? "theremin" : "scale_gate";

      playModeRef.current = mode;



      const degree = ev.right.scale_degree ?? currentDegreeRef.current ?? 0;

      const note = ev.right.gate_open

        ? noteAtDegree(scale, degree, octaveShiftRef.current)

        : "—";



      lastFrameRef.current = ev;

      setStatus({

        handsLabel,

        activeHand: rightOn ? "Right" : leftOn ? "Left" : null,

        leftOn,

        rightOn,

        effectiveVolume: vol,

        volumeActive: Boolean(ev.pair.volume_active),

        waitingForHands: count === 0,

        lastFrame: ev,

        gateOpen: Boolean(ev.right.gate_open),

        currentNote: note,

        scaleDegree: degree,

        scaleSize: scaleSize(scale),

        scaleName: scale,

        rightGesture: ev.right.gesture ?? "—",

        playMode: mode,

      });



      if (mode === "theremin") {

        handleTheremin(ev);

      } else {

        handleScaleGate(ev);

      }

    },

    [handleTheremin, handleScaleGate]

  );



  const handleGestureStable = useCallback(

    (ev: GestureStableEvent) => {

      const synth = synthRef.current;

      if (!synth || !audioStartedRef.current || ev.gesture === "None") return;

      const now = Date.now();

      if (now - lastTriggerRef.current < 150) return;

      lastTriggerRef.current = now;



      if (playModeRef.current === "scale_gate") {

        if (ev.gesture === "Thumb_Up" && ev.hand === "Left") {

          octaveShiftRef.current = Math.min(2, octaveShiftRef.current + 1);

          setLastNote(`Oitava +${octaveShiftRef.current}`);

          return;

        }

        if (ev.gesture === "Thumb_Down" && ev.hand === "Left") {

          octaveShiftRef.current = Math.max(-2, octaveShiftRef.current - 1);

          setLastNote(`Oitava ${octaveShiftRef.current}`);

          return;

        }

        if (ev.gesture === "Pointing_Up" && ev.hand === "Right") {

          const frame = lastFrameRef.current;

          if (!frame?.right.gate_open || !soundingRef.current) return;

          const scale = frame.scale ?? scaleNameRef.current;

          const deg =

            frame.right.scale_degree ?? currentDegreeRef.current ?? 0;

          const n = noteAtDegree(scale, deg, octaveShiftRef.current);

          synth.triggerAttack(n);

          lastPlayedNoteRef.current = n;

          setLastNote(`${n} (acento)`);

        }

      }

    },

    []

  );



  const handleLine = useCallback(

    (line: string) => {

      try {

        const ev = JSON.parse(line) as { type: string };

        if (ev.type === "control.frame") {

          handleControlFrame(ev as ControlFrameEvent);

        } else if (ev.type === "control.change") {

          const ch = ev as ControlChangeEvent;

          if (ch.change === "octave_up") {

            octaveShiftRef.current = Math.min(2, octaveShiftRef.current + 1);

          } else if (ch.change === "octave_down") {

            octaveShiftRef.current = Math.max(-2, octaveShiftRef.current - 1);

          }

        } else if (ev.type === "gesture.stable") {

          handleGestureStable(ev as GestureStableEvent);

        }

      } catch {

        /* ignore */

      }

    },

    [handleControlFrame, handleGestureStable]

  );



  return {

    ready,

    start,

    lastNote,

    status,

    handleLine,

    handleControlFrame,

    handleGestureStable,

  };

}


