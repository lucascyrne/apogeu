import type { HandState, HandsSnapshot, Landmark } from "./types";
import { clamp01 } from "./smooth";
import { mapPointToRoiClamped, pitchNormFromCameraPoint } from "./viewport";

const WRIST = 0;

export type HandFeatures = {
  presence: boolean;
  in_roi: boolean;
  x_norm: number;
  y_norm: number;
  z_norm: number;
  spatial_x: number;
  spatial_y: number;
};

export type RawFeatures = {
  left: HandFeatures;
  right: HandFeatures;
  hands_distance: number;
  spread: number;
};

const EMPTY: HandFeatures = {
  presence: false,
  in_roi: false,
  x_norm: 0.5,
  y_norm: 0.5,
  z_norm: 0.5,
  spatial_x: 0.5,
  spatial_y: 0.5,
};

function handFeatures(hand: HandState | null | undefined): HandFeatures {
  if (!hand?.presence || !hand.landmarks?.length) return EMPTY;

  const lm = hand.landmarks[WRIST];
  const roi = mapPointToRoiClamped(lm.x, lm.y);

  return {
    presence: true,
    in_roi: roi.in_roi,
    x_norm: pitchNormFromCameraPoint(lm.x, lm.y, "x"),
    y_norm: pitchNormFromCameraPoint(lm.x, lm.y, "y"),
    z_norm: clamp01(-lm.z * 0.5 + 0.5),
    spatial_x: clamp01(roi.x),
    spatial_y: clamp01(roi.y),
  };
}

function roiLandmarks(landmarks: Landmark[]): Landmark[] {
  const out: Landmark[] = [];
  for (const p of landmarks) {
    const roi = mapPointToRoiClamped(p.x, p.y);
    out.push({ x: roi.x, y: roi.y, z: p.z });
  }
  return out;
}

export function extractRawFeatures(snapshot: HandsSnapshot | null): RawFeatures {
  if (!snapshot) {
    return {
      left: EMPTY,
      right: EMPTY,
      hands_distance: 0,
      spread: 0,
    };
  }

  const left = handFeatures(snapshot.left);
  const right = handFeatures(snapshot.right);
  let hands_distance = 0;
  let spread = 0;

  if (left.presence && right.presence) {
    const dx = left.spatial_x - right.spatial_x;
    const dy = left.spatial_y - right.spatial_y;
    hands_distance = clamp01(Math.hypot(dx, dy));
  }

  const allLm: Landmark[] = [];
  if (snapshot.left?.landmarks) allLm.push(...roiLandmarks(snapshot.left.landmarks));
  if (snapshot.right?.landmarks) {
    allLm.push(...roiLandmarks(snapshot.right.landmarks));
  }
  if (allLm.length) {
    const xs = allLm.map((p) => p.x);
    const ys = allLm.map((p) => p.y);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    spread = clamp01(Math.sqrt(bw * bw + bh * bh));
  }

  return { left, right, hands_distance, spread };
}
