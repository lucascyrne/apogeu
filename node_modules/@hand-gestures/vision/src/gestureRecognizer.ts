import {
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import type { HandsSnapshot } from "@hand-gestures/mapping";

import { parseGestureResult } from "./snapshot";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

export type RecognizerOptions = {
  modelUrl: string;
  wasmBaseUrl?: string;
  numHands?: number;
};

export class BrowserGestureRecognizer {
  private recognizer: GestureRecognizer | null = null;
  private snapshot: HandsSnapshot | null = null;
  private slotHistory: Array<[string | null, string | null]> = [];
  private lastTimestamp = -1;

  async init(options: RecognizerOptions): Promise<void> {
    const wasm = options.wasmBaseUrl ?? WASM_CDN;
    const vision = await FilesetResolver.forVisionTasks(wasm);
    this.recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: options.modelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: options.numHands ?? 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  detect(video: HTMLVideoElement, timestampMs: number): HandsSnapshot | null {
    if (!this.recognizer || video.readyState < 2) return this.snapshot;

    let ts = timestampMs;
    if (ts <= this.lastTimestamp) ts = this.lastTimestamp + 1;
    this.lastTimestamp = ts;

    const result = this.recognizer.recognizeForVideo(video, ts);
    this.snapshot = parseGestureResult(
      {
        gestures: result.gestures as Parameters<typeof parseGestureResult>[0]["gestures"],
        handedness: result.handedness as Parameters<typeof parseGestureResult>[0]["handedness"],
        landmarks: result.landmarks as Parameters<typeof parseGestureResult>[0]["landmarks"],
      },
      ts,
      this.slotHistory
    );
    return this.snapshot;
  }

  get latest(): HandsSnapshot | null {
    return this.snapshot;
  }

  close(): void {
    this.recognizer?.close();
    this.recognizer = null;
  }
}
