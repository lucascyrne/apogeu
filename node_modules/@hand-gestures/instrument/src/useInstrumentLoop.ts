import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ExpressionEngine,
  GestureMapper,
  loadInstrumentConfig,
  type InstrumentConfig,
} from "@hand-gestures/mapping";
import type { GestureStableEvent } from "@hand-gestures/protocol";
import { BrowserGestureRecognizer, GestureStabilizer } from "@hand-gestures/vision";

const EMIT_MS = 33;
const MODEL_URL = "/models/gesture_recognizer.task";
const CONFIG_URL = "/config/default-instrument.yaml";

export type LoopState = {
  running: boolean;
  loading: boolean;
  error: string | null;
  fps: number;
  lastGesture: GestureStableEvent | null;
};

export function useInstrumentLoop(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean,
  onLine: (line: string) => void
) {
  const [state, setState] = useState<LoopState>({
    running: false,
    loading: false,
    error: null,
    fps: 0,
    lastGesture: null,
  });

  const configRef = useRef<InstrumentConfig | null>(null);
  const recognizerRef = useRef<BrowserGestureRecognizer | null>(null);
  const stabilizerRef = useRef<GestureStabilizer | null>(null);
  const expressionRef = useRef<ExpressionEngine | null>(null);
  const mapperRef = useRef<GestureMapper | null>(null);
  const lastEmitRef = useRef(0);
  const lastSnapshotRef = useRef<ReturnType<BrowserGestureRecognizer["detect"]>>(null);
  const rafRef = useRef(0);
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  useEffect(() => {
    if (!enabled) {
      recognizerRef.current?.close();
      recognizerRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setState((s) => ({ ...s, running: false, loading: false }));
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const config = await loadInstrumentConfig(CONFIG_URL);
        if (cancelled) return;
        configRef.current = config;

        const recognizer = new BrowserGestureRecognizer();
        await recognizer.init({ modelUrl: MODEL_URL, numHands: 2 });
        if (cancelled) return;
        recognizerRef.current = recognizer;

        stabilizerRef.current = new GestureStabilizer({
          voteWindow: 12,
          minConsecutive: 6,
          cooldownMs: 300,
          scoreThreshold: 0.6,
          musical: true,
        });
        expressionRef.current = new ExpressionEngine({
          alpha: config.smoothingAlpha,
          pitchAlpha: config.pitchAlpha,
          spatialAlpha: config.spatialAlpha,
          distanceAlpha: config.distanceAlpha,
        });
        mapperRef.current = new GestureMapper(config);

        setState((s) => ({ ...s, loading: false, running: true }));

        let frames = 0;
        let fpsT = performance.now();

        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const rec = recognizerRef.current;
          const stab = stabilizerRef.current;
          const expr = expressionRef.current;
          const mapper = mapperRef.current;
          if (!video || !rec || !stab || !expr || !mapper) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const now = performance.now();
          const snapshot = rec.detect(video, Math.round(now));
          if (snapshot) {
            lastSnapshotRef.current = snapshot;
            const gestureOut = stab.update(snapshot, Math.round(now));
            if (gestureOut) {
              const events = Array.isArray(gestureOut) ? gestureOut : [gestureOut];
              for (const gev of events) {
                onLineRef.current(JSON.stringify(gev));
                setState((s) => ({ ...s, lastGesture: gev }));

                const action = mapper.gestureAction(
                  gev.gesture,
                  gev.hand ?? null
                );
                if (action?.action === "octave_up") mapper.applyOctaveShift(1);
                else if (action?.action === "octave_down") mapper.applyOctaveShift(-1);
              }
            }
          }

          if (now - lastEmitRef.current >= EMIT_MS && lastSnapshotRef.current) {
            lastEmitRef.current = now;
            const smoothed = expr.process(lastSnapshotRef.current);
            const control = mapper.mapFrame(
              smoothed,
              Math.round(now),
              stab.leftGesture,
              stab.rightGesture,
              stab.rightGestureStable
            );
            onLineRef.current(JSON.stringify(control));
          }

          frames += 1;
          if (now - fpsT >= 1000) {
            setState((s) => ({ ...s, fps: frames }));
            frames = 0;
            fpsT = now;
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            running: false,
            error:
              e instanceof Error
                ? e.message
                : "Falha ao iniciar visão (modelo em /public/models/?)",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      recognizerRef.current?.close();
      recognizerRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, videoRef]);

  return state;
}
