"""Área central de captura (75% do quadro)."""

from __future__ import annotations

CAPTURE_SIZE = 0.75
ROI_MARGIN = (1 - CAPTURE_SIZE) / 2


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def in_capture_roi(x: float, y: float) -> bool:
    hi = 1.0 - ROI_MARGIN
    return ROI_MARGIN <= x <= hi and ROI_MARGIN <= y <= hi


def clamp_to_capture_roi(x: float, y: float) -> tuple[float, float]:
    hi = 1.0 - ROI_MARGIN
    return (
        max(ROI_MARGIN, min(hi, x)),
        max(ROI_MARGIN, min(hi, y)),
    )


def map_point_to_roi(x: float, y: float) -> tuple[float, float] | None:
    if not in_capture_roi(x, y):
        return None
    return ((x - ROI_MARGIN) / CAPTURE_SIZE, (y - ROI_MARGIN) / CAPTURE_SIZE)


def map_point_to_roi_clamped(x: float, y: float) -> tuple[float, float, bool]:
    in_roi = in_capture_roi(x, y)
    cx, cy = (x, y) if in_roi else clamp_to_capture_roi(x, y)
    return (
        (cx - ROI_MARGIN) / CAPTURE_SIZE,
        (cy - ROI_MARGIN) / CAPTURE_SIZE,
        in_roi,
    )


def roi_y_to_pitch_norm(roi_y: float) -> float:
    return _clamp01(1.0 - roi_y)


def pitch_norm_from_camera_point(
    x: float, y: float, pitch_axis: str = "y"
) -> float:
    hi = 1.0 - ROI_MARGIN
    if pitch_axis == "y":
        if y < ROI_MARGIN:
            return 1.0
        if y > hi:
            return 0.0
        roi = map_point_to_roi(x, y)
        if roi is None:
            return _clamp01(1.0 - y)
        return roi_y_to_pitch_norm(roi[1])
    if pitch_axis == "x":
        if x < ROI_MARGIN:
            return 0.0
        if x > hi:
            return 1.0
        roi = map_point_to_roi(x, y)
        if roi is None:
            return _clamp01(x)
        return _clamp01(roi[0])
    return _clamp01(-y * 0.5 + 0.5)
