"""Orquestra features brutas + suavização."""

from __future__ import annotations

from dataclasses import dataclass

from src.expression.features import RawFeatures, extract_raw_features
from src.expression.smooth import SmoothedFeatures
from src.recognizer import HandsSnapshot


@dataclass
class SmoothedHandFeatures:
    presence: bool
    x_norm: float
    y_norm: float
    z_norm: float
    spatial_x: float
    spatial_y: float
    pan: float


@dataclass
class SmoothedFrame:
    left: SmoothedHandFeatures
    right: SmoothedHandFeatures
    hands_distance: float
    spread: float


class ExpressionEngine:
    def __init__(self, dead_zone: float = 0.06, alpha: float = 0.35) -> None:
        self._smooth = SmoothedFeatures(dead_zone=dead_zone, alpha=alpha)

    def process(self, snapshot: HandsSnapshot | None) -> SmoothedFrame:
        raw = extract_raw_features(snapshot)
        return self._smooth_raw(raw)

    def _smooth_raw(self, raw: RawFeatures) -> SmoothedFrame:
        s = self._smooth

        left = SmoothedHandFeatures(
            presence=raw.left.presence,
            x_norm=s.filter("lsx", raw.left.spatial_x),
            y_norm=s.filter("ly", raw.left.y_norm),
            z_norm=s.filter("lz", raw.left.z_norm),
            spatial_x=s.filter("lsx2", raw.left.spatial_x),
            spatial_y=s.filter("lsy", raw.left.spatial_y),
            pan=0.0,
        )
        right = SmoothedHandFeatures(
            presence=raw.right.presence,
            x_norm=s.filter("rsx", raw.right.spatial_x),
            y_norm=s.filter("ry", raw.right.y_norm),
            z_norm=s.filter("rz", raw.right.z_norm),
            spatial_x=s.filter("rsx2", raw.right.spatial_x),
            spatial_y=s.filter("rsy", raw.right.spatial_y),
            pan=0.0,
        )
        return SmoothedFrame(
            left=left,
            right=right,
            hands_distance=s.filter("dist", raw.hands_distance, use_dead_zone=False),
            spread=s.filter("spread", raw.spread, use_dead_zone=False),
        )
