export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function ema(prev: number, next: number, alpha = 0.35): number {
  return prev * (1 - alpha) + next * alpha;
}

export class SmoothedFeatures {
  private state = new Map<string, number>();

  constructor(
    private alpha = 0.2,
    private pitchAlpha = 0.15,
    private spatialAlpha = 0.25,
    private distanceAlpha = 0.22
  ) {}

  filter(key: string, value: number, kind: "default" | "pitch" | "spatial" | "distance" = "default"): number {
    const prev = this.state.get(key) ?? value;
    const a =
      kind === "pitch"
        ? this.pitchAlpha
        : kind === "spatial"
          ? this.spatialAlpha
          : kind === "distance"
            ? this.distanceAlpha
            : this.alpha;
    const smoothed = ema(prev, value, a);
    this.state.set(key, smoothed);
    return smoothed;
  }
}
