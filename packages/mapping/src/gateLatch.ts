export class GateLatch {
  private openBuffer: string[] = [];
  private closeBuffer: string[] = [];
  private absentStreak = 0;
  private latched = false;

  constructor(
    private gateOn: Set<string>,
    private gateOff: Set<string>,
    private window = 8,
    private openThreshold = 5,
    private closeThreshold = 5,
    private absentHold = 10
  ) {}

  static fromLists(
    gateOn: string[],
    gateOff: string[],
    opts?: Partial<{
      window: number;
      openThreshold: number;
      closeThreshold: number;
      absentHold: number;
    }>
  ): GateLatch {
    return new GateLatch(
      new Set(gateOn),
      new Set(gateOff.filter((g) => g && g !== "None")),
      opts?.window ?? 8,
      opts?.openThreshold ?? 5,
      opts?.closeThreshold ?? 5,
      opts?.absentHold ?? 10
    );
  }

  get isOpen(): boolean {
    return this.latched;
  }

  update(
    liveGesture: string,
    presence: boolean,
    stableGesture?: string | null
  ): boolean {
    if (!presence) {
      this.absentStreak += 1;
      if (this.absentStreak >= this.absentHold) {
        this.openBuffer = [];
        this.closeBuffer = [];
        this.latched = false;
      }
      return this.latched;
    }

    this.absentStreak = 0;
    const live = liveGesture || "None";
    const stable = stableGesture ?? live;

    if (!this.latched) {
      this.push(this.openBuffer, live);
      if (this.countIn(this.openBuffer, this.gateOn) >= this.openThreshold) {
        this.latched = true;
      }
      return this.latched;
    }

    this.push(this.closeBuffer, stable);
    if (
      this.gateOff.size > 0 &&
      this.countIn(this.closeBuffer, this.gateOff) >= this.closeThreshold
    ) {
      this.latched = false;
      this.openBuffer = [];
      this.closeBuffer = [];
    }
    return this.latched;
  }

  private push(buf: string[], v: string): void {
    buf.push(v);
    if (buf.length > this.window) buf.shift();
  }

  private countIn(buf: string[], labels: Set<string>): number {
    return buf.filter((x) => labels.has(x)).length;
  }
}
