export * from "./types";
export { ToneScaleGateEngine } from "./toneScaleGateEngine";

import { ToneScaleGateEngine } from "./toneScaleGateEngine";
import type { AudioEngine } from "./types";

export function createAudioEngine(): AudioEngine {
  return new ToneScaleGateEngine();
}
