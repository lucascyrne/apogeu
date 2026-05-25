const IDLE_RESET_MS = 1000;
const MIN_SPAN = 0.02;

export class DistanceCalibrator {
  private autoMin: number | null = null;
  private autoMax: number | null = null;
  private lastCalibrateMs = 0;

  constructor(
    private cfgMin: number | null = null,
    private cfgMax: number | null = null
  ) {}

  map(raw: number, calibrating: boolean, timestampMs: number): number {
    if (calibrating) {
      this.lastCalibrateMs = timestampMs;
      this.updateAuto(raw);
    } else if (timestampMs - this.lastCalibrateMs > IDLE_RESET_MS) {
      this.autoMin = null;
      this.autoMax = null;
    }

    const range = this.range();
    if (range.lo == null || range.hi == null) {
      return Math.max(0, Math.min(1, raw));
    }
    const span = Math.max(range.hi - range.lo, MIN_SPAN);
    return Math.max(0, Math.min(1, (raw - range.lo) / span));
  }

  private range(): { lo: number | null; hi: number | null } {
    if (this.autoMin != null && this.autoMax != null) {
      if (this.autoMax - this.autoMin >= MIN_SPAN) {
        return { lo: this.autoMin, hi: this.autoMax };
      }
    }
    if (this.cfgMin != null && this.cfgMax != null) {
      return { lo: this.cfgMin, hi: this.cfgMax };
    }
    return { lo: null, hi: null };
  }

  private updateAuto(raw: number): void {
    if (this.autoMin == null) {
      this.autoMin = raw;
      this.autoMax = raw;
      return;
    }
    if (this.autoMin != null && raw < this.autoMin) {
      this.autoMin = this.autoMin * 0.88 + raw * 0.12;
    } else if (this.autoMax != null && raw > this.autoMax) {
      this.autoMax = this.autoMax * 0.88 + raw * 0.12;
    }
  }
}
