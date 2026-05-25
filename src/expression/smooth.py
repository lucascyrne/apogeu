"""Suavização temporal (EMA + zona morta)."""

from __future__ import annotations


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def apply_dead_zone(value: float, center: float = 0.5, zone: float = 0.06) -> float:
    if abs(value - center) < zone:
        return center
    return value


def ema(prev: float, new: float, alpha: float = 0.35) -> float:
    return prev * (1.0 - alpha) + new * alpha


class SmoothedFeatures:
    """Estado de suavização por canal."""

    def __init__(self, dead_zone: float = 0.06, alpha: float = 0.35) -> None:
        self._dead_zone = dead_zone
        self._alpha = alpha
        self._state: dict[str, float] = {}

    def filter(self, key: str, value: float, use_dead_zone: bool = True) -> float:
        prev = self._state.get(key, value)
        smoothed = ema(prev, value, self._alpha)
        if use_dead_zone:
            smoothed = apply_dead_zone(smoothed, 0.5, self._dead_zone)
        self._state[key] = smoothed
        return smoothed

    def filter_pan(self, key: str, x_norm: float) -> float:
        pan = (x_norm - 0.5) * 2.0
        prev = self._state.get(key, pan)
        smoothed = ema(prev, pan, self._alpha)
        if abs(smoothed) < self._dead_zone:
            smoothed = 0.0
        self._state[key] = smoothed
        return max(-1.0, min(1.0, smoothed))
