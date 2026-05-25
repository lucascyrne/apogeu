import type { GestureStableEvent } from "@hand-gestures/protocol";
import type { HandState, HandsSnapshot } from "@hand-gestures/mapping";

export type StabilizerConfig = {
  voteWindow: number;
  minConsecutive: number;
  cooldownMs: number;
  scoreThreshold: number;
  musical: boolean;
};

class SingleHandStabilizer {
  private buffer: string[] = [];
  private stableGesture = "None";
  private stableScore = 0;
  private lastEmitMs = 0;
  private consecutive = 0;
  private lastVoted = "None";

  constructor(
    private config: StabilizerConfig,
    private handLabel: string
  ) {}

  get currentGesture(): string {
    return this.stableGesture;
  }

  get currentScore(): number {
    return this.stableScore;
  }

  get liveGesture(): string {
    return this.majorityVote();
  }

  update(hand: HandState | null, timestampMs: number): GestureStableEvent | null {
    let rawGesture = "None";
    let rawScore = 0;
    if (hand?.presence && hand.gesture) {
      rawGesture = hand.gesture;
      rawScore = hand.score;
    }
    if (rawScore < this.config.scoreThreshold) {
      rawGesture = "None";
      rawScore = 0;
    }

    this.buffer.push(rawGesture);
    if (this.buffer.length > this.config.voteWindow) this.buffer.shift();

    const voted = this.majorityVote();
    if (voted === this.lastVoted) this.consecutive += 1;
    else {
      this.lastVoted = voted;
      this.consecutive = 1;
    }

    if (
      this.consecutive < this.config.minConsecutive ||
      voted === this.stableGesture
    ) {
      return null;
    }

    if (this.lastEmitMs > 0 && timestampMs - this.lastEmitMs < this.config.cooldownMs) {
      return null;
    }

    this.stableGesture = voted;
    this.stableScore = voted !== "None" ? rawScore : 0;
    this.lastEmitMs = timestampMs;

    return {
      type: "gesture.stable",
      schema_version: "2",
      gesture: this.stableGesture,
      score: this.stableScore,
      hand: this.handLabel,
      timestamp_ms: timestampMs,
    };
  }

  private majorityVote(): string {
    if (!this.buffer.length) return "None";
    const counts = new Map<string, number>();
    for (const g of this.buffer) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    let best = "None";
    let max = 0;
    for (const [g, c] of counts) {
      if (c > max) {
        max = c;
        best = g;
      }
    }
    return best;
  }
}

export class GestureStabilizer {
  private left: SingleHandStabilizer;
  private right: SingleHandStabilizer;
  private single: SingleHandStabilizer;

  constructor(config: StabilizerConfig) {
    this.left = new SingleHandStabilizer(config, "Left");
    this.right = new SingleHandStabilizer(config, "Right");
    this.single = new SingleHandStabilizer(config, "Right");
    this.config = config;
  }

  private config: StabilizerConfig;

  get leftGesture(): string {
    return this.config.musical ? this.left.liveGesture : this.single.liveGesture;
  }

  get rightGesture(): string {
    return this.config.musical ? this.right.liveGesture : this.single.liveGesture;
  }

  get rightGestureStable(): string {
    return this.config.musical
      ? this.right.currentGesture
      : this.single.currentGesture;
  }

  update(
    snapshot: HandsSnapshot | null,
    timestampMs: number
  ): GestureStableEvent | GestureStableEvent[] | null {
    if (!this.config.musical) {
      const hand = snapshot?.right.presence
        ? snapshot.right
        : snapshot?.left.presence
          ? snapshot.left
          : null;
      const ev = this.single.update(hand, timestampMs);
      return ev;
    }

    const events: GestureStableEvent[] = [];
    const evL = this.left.update(snapshot?.left ?? null, timestampMs);
    const evR = this.right.update(snapshot?.right ?? null, timestampMs);
    if (evL) events.push(evL);
    if (evR) events.push(evR);
    return events.length ? events : null;
  }
}
