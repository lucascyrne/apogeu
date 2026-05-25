"""Calibração de distância entre mãos → volume 0–1."""

from __future__ import annotations

_IDLE_RESET_MS = 1000
_MIN_SPAN = 0.04


class DistanceCalibrator:
    """Auto-calibra por sessão; limites YAML só como fallback inicial."""

    def __init__(
        self,
        dist_min: float | None = None,
        dist_max: float | None = None,
    ) -> None:
        self._cfg_min = dist_min
        self._cfg_max = dist_max
        self._auto_min: float | None = None
        self._auto_max: float | None = None
        self._last_calibrate_ms = 0

    def map(self, raw: float, calibrating: bool, timestamp_ms: int) -> float:
        if calibrating:
            self._last_calibrate_ms = timestamp_ms
            self._update_auto(raw)
        elif timestamp_ms - self._last_calibrate_ms > _IDLE_RESET_MS:
            self._auto_min = None
            self._auto_max = None

        lo, hi = self._range()
        if lo is None or hi is None:
            return max(0.0, min(1.0, raw))

        span = max(hi - lo, _MIN_SPAN)
        return max(0.0, min(1.0, (raw - lo) / span))

    def _range(self) -> tuple[float | None, float | None]:
        if self._auto_min is not None and self._auto_max is not None:
            if self._auto_max - self._auto_min >= _MIN_SPAN:
                return self._auto_min, self._auto_max
        if self._cfg_min is not None and self._cfg_max is not None:
            return self._cfg_min, self._cfg_max
        return None, None

    def _update_auto(self, raw: float) -> None:
        if self._auto_min is None:
            self._auto_min = raw
            self._auto_max = raw
            return
        if raw < self._auto_min:
            self._auto_min = self._auto_min * 0.88 + raw * 0.12
        elif raw > self._auto_max:
            self._auto_max = self._auto_max * 0.88 + raw * 0.12
