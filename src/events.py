"""Contrato de eventos JSON (v1 legado + v2 musical)."""

from __future__ import annotations

import sys
from collections.abc import Callable
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

SCHEMA_VERSION = "2"


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float


# --- v1 legado ---


class GestureEvent(BaseModel):
    type: Literal["gesture.stable"] = "gesture.stable"
    gesture: str
    score: float = Field(ge=0.0, le=1.0)
    handedness: str | None = None
    timestamp_ms: int
    landmarks: list[LandmarkPoint] | None = None
    schema_version: str | None = None
    hand: str | None = None


# --- v2 musical ---


class HandControl(BaseModel):
    presence: bool = False
    x: float = 0.5
    y: float = 0.5
    z: float = 0.5
    pan: float = 0.0
    pitch_norm: float = 0.5
    mod: float = 0.0
    gesture: str | None = None
    gate_open: bool = False
    scale_degree: int | None = None


class PairControl(BaseModel):
    hands_distance: float = 0.0
    volume_master: float = 0.0
    spread: float = 0.0
    volume_active: bool = False


class ControlFrameEvent(BaseModel):
    schema_version: Literal["2"] = "2"
    type: Literal["control.frame"] = "control.frame"
    timestamp_ms: int
    preset: str
    scale: str = "pentatonic"
    left: HandControl
    right: HandControl
    pair: PairControl


class ControlChangeEvent(BaseModel):
    schema_version: Literal["2"] = "2"
    type: Literal["control.change"] = "control.change"
    timestamp_ms: int
    change: str
    value: str


class EventEmitter:
    """Emite NDJSON no stdout com throttle para control.frame."""

    def __init__(
        self,
        emit_rate_hz: float = 30.0,
        record_path: Path | None = None,
        broadcast: Callable[[str], None] | None = None,
    ) -> None:
        self._min_interval_ms = int(1000.0 / emit_rate_hz) if emit_rate_hz > 0 else 0
        self._last_control_ms = 0
        self._record_file = None
        self._broadcast = broadcast
        if record_path is not None:
            self._record_file = open(record_path, "w", encoding="utf-8")

    def close(self) -> None:
        if self._record_file is not None:
            self._record_file.close()
            self._record_file = None

    def emit(self, event: BaseModel) -> None:
        line = event.model_dump_json()
        print(line, flush=True)
        if self._broadcast is not None:
            self._broadcast(line)
        if self._record_file is not None:
            self._record_file.write(line + "\n")
            self._record_file.flush()

    def emit_control_if_due(self, event: ControlFrameEvent, timestamp_ms: int) -> bool:
        if self._min_interval_ms > 0 and timestamp_ms - self._last_control_ms < self._min_interval_ms:
            return False
        self._last_control_ms = timestamp_ms
        self.emit(event)
        return True


def emit(event: BaseModel) -> None:
    print(event.model_dump_json(), flush=True)


def emit_stderr(message: str) -> None:
    print(message, file=sys.stderr, flush=True)
