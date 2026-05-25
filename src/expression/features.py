"""Landmarks → features geométricas normalizadas."""

from __future__ import annotations

import math
from dataclasses import dataclass

from src.expression.viewport import (
    map_point_to_roi_clamped,
    pitch_norm_from_camera_point,
)
from src.recognizer import HandState, HandsSnapshot, Landmark

WRIST = 0


@dataclass
class HandFeatures:
    presence: bool
    in_roi: bool
    x_norm: float
    y_norm: float
    z_norm: float
    spatial_x: float
    spatial_y: float


@dataclass
class RawFeatures:
    left: HandFeatures
    right: HandFeatures
    hands_distance: float
    spread: float


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


_EMPTY = HandFeatures(
    presence=False,
    in_roi=False,
    x_norm=0.5,
    y_norm=0.5,
    z_norm=0.5,
    spatial_x=0.5,
    spatial_y=0.5,
)


def _hand_features(hand: HandState | None) -> HandFeatures:
    if hand is None or not hand.presence or not hand.landmarks:
        return _EMPTY

    lm = hand.landmarks[WRIST]
    rx, ry, in_roi = map_point_to_roi_clamped(lm.x, lm.y)

    return HandFeatures(
        presence=True,
        in_roi=in_roi,
        x_norm=pitch_norm_from_camera_point(lm.x, lm.y, "x"),
        y_norm=pitch_norm_from_camera_point(lm.x, lm.y, "y"),
        z_norm=_clamp01(-lm.z * 0.5 + 0.5),
        spatial_x=_clamp01(rx),
        spatial_y=_clamp01(ry),
    )


def _roi_landmarks(landmarks: list[Landmark]) -> list[Landmark]:
    out: list[Landmark] = []
    for p in landmarks:
        rx, ry, _ = map_point_to_roi_clamped(p.x, p.y)
        out.append(Landmark(x=rx, y=ry, z=p.z))
    return out


def extract_raw_features(snapshot: HandsSnapshot | None) -> RawFeatures:
    if snapshot is None:
        return RawFeatures(left=_EMPTY, right=_EMPTY, hands_distance=0.0, spread=0.0)

    left = _hand_features(snapshot.left)
    right = _hand_features(snapshot.right)

    hands_distance = 0.0
    spread = 0.0

    if left.presence and right.presence:
        dx = left.spatial_x - right.spatial_x
        dy = left.spatial_y - right.spatial_y
        hands_distance = _clamp01(math.hypot(dx, dy))

    all_lm: list[Landmark] = []
    if snapshot.left and snapshot.left.landmarks:
        all_lm.extend(_roi_landmarks(snapshot.left.landmarks))
    if snapshot.right and snapshot.right.landmarks:
        all_lm.extend(_roi_landmarks(snapshot.right.landmarks))
    if all_lm:
        xs = [p.x for p in all_lm]
        ys = [p.y for p in all_lm]
        bw = max(xs) - min(xs)
        bh = max(ys) - min(ys)
        spread = _clamp01(math.sqrt(bw * bw + bh * bh))

    return RawFeatures(
        left=left,
        right=right,
        hands_distance=hands_distance,
        spread=spread,
    )
