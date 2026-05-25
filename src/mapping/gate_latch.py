"""Porta de nota com latch: abre com palma (live), fecha com punho (estável)."""

from __future__ import annotations

from collections import deque


class GateLatch:
    """Mantém gate aberto entre gestos intermediários e ausências breves da mão."""

    def __init__(
        self,
        gate_on: list[str],
        gate_off: list[str],
        window: int = 8,
        open_threshold: int = 5,
        close_threshold: int = 5,
        absent_hold: int = 10,
    ) -> None:
        self._gate_on = set(gate_on)
        self._gate_off = {g for g in gate_off if g and g != "None"}
        self._open_buffer: deque[str] = deque(maxlen=window)
        self._close_buffer: deque[str] = deque(maxlen=window)
        self._open_threshold = open_threshold
        self._close_threshold = close_threshold
        self._absent_hold = absent_hold
        self._absent_streak = 0
        self._latched = False

    def update(
        self,
        live_gesture: str,
        presence: bool,
        stable_gesture: str | None = None,
    ) -> bool:
        if not presence:
            self._absent_streak += 1
            if self._absent_streak >= self._absent_hold:
                self._open_buffer.clear()
                self._close_buffer.clear()
                self._latched = False
            return self._latched

        self._absent_streak = 0
        live = live_gesture if live_gesture else "None"
        stable = stable_gesture if stable_gesture else live

        if not self._latched:
            self._open_buffer.append(live)
            if self._count_in(self._open_buffer, self._gate_on) >= self._open_threshold:
                self._latched = True
            return self._latched

        self._close_buffer.append(stable)
        if self._gate_off and self._count_in(
            self._close_buffer, self._gate_off
        ) >= self._close_threshold:
            self._latched = False
            self._open_buffer.clear()
            self._close_buffer.clear()
        return self._latched

    @staticmethod
    def _count_in(buf: deque[str], labels: set[str]) -> int:
        return sum(1 for x in buf if x in labels)
