import type { HandState, HandsSnapshot, Landmark } from "@hand-gestures/mapping";

const WRIST = 0;

export function emptyHand(handedness: string): HandState {
  return {
    gesture: null,
    score: 0,
    handedness,
    landmarks: null,
    presence: false,
  };
}

function wristX(hand: HandState): number {
  const lm = hand.landmarks?.[WRIST];
  return lm?.x ?? 0.5;
}

/** Slots por mão física (MediaPipe handedness); fallback X só com uma mão. */
export function assignHandSlots(
  detected: HandState[],
  history: Array<[string | null, string | null]>
): { left: HandState; right: HandState } {
  let left: HandState | null = null;
  let right: HandState | null = null;
  const unassigned: HandState[] = [];

  for (const hand of detected) {
    const label = hand.handedness === "Left" ? "Left" : "Right";
    if (label === "Left" && !left) left = hand;
    else if (label === "Right" && !right) right = hand;
    else unassigned.push(hand);
  }

  for (const hand of unassigned) {
    if (!left) left = { ...hand, handedness: "Left" };
    else if (!right) right = { ...hand, handedness: "Right" };
  }

  if (detected.length === 1 && !left && !right) {
    const only = detected[0];
    const slot = inferSingleHandSlot(history, wristX(only), only.handedness);
    if (slot === "Right") {
      return {
        left: emptyHand("Left"),
        right: { ...only, handedness: only.handedness || "Right" },
      };
    }
    return {
      left: { ...only, handedness: only.handedness || "Left" },
      right: emptyHand("Right"),
    };
  }

  return {
    left: left ?? emptyHand("Left"),
    right: right ?? emptyHand("Right"),
  };
}

function inferSingleHandSlot(
  history: Array<[string | null, string | null]>,
  x: number,
  mpLabel: string
): "Left" | "Right" {
  if (mpLabel === "Left" || mpLabel === "Right") return mpLabel;
  for (let i = history.length - 1; i >= 0; i--) {
    const [l, r] = history[i];
    if (l && !r) return "Left";
    if (r && !l) return "Right";
  }
  return x < 0.5 ? "Left" : "Right";
}

export type MpGestureResult = {
  gestures?: Array<Array<{ categoryName?: string; score?: number }>>;
  handedness?: Array<Array<{ categoryName?: string }>>;
  landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
};

export function parseGestureResult(
  result: MpGestureResult,
  timestampMs: number,
  history: Array<[string | null, string | null]>
): HandsSnapshot {
  if (!result.gestures?.length) {
    return {
      left: emptyHand("Left"),
      right: emptyHand("Right"),
      timestamp_ms: timestampMs,
    };
  }

  const detected: HandState[] = [];
  for (let i = 0; i < result.gestures.length; i++) {
    const gList = result.gestures[i];
    const top = gList?.[0];
    let handedness = "Right";
    const hList = result.handedness?.[i];
    if (hList?.[0]?.categoryName) handedness = hList[0].categoryName;

    let landmarks: Landmark[] | null = null;
    const lmList = result.landmarks?.[i];
    if (lmList?.length) {
      landmarks = lmList.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }));
    }

    detected.push({
      gesture: top?.categoryName ?? null,
      score: top?.score ?? 0,
      handedness,
      landmarks,
      presence: true,
    });
  }

  const { left, right } = assignHandSlots(detected, history);
  history.push([
    left.presence ? "Left" : null,
    right.presence ? "Right" : null,
  ]);
  if (history.length > 5) history.shift();

  return { left, right, timestamp_ms: timestampMs };
}
