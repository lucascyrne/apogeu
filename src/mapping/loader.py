"""Carrega config/default-instrument.yaml."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from src.config import DEFAULT_INSTRUMENT_PATH


@dataclass
class HandRole:
    pitch_axis: str = "y"
    pan_axis: str = "x"
    mod_axis: str = "z"


@dataclass
class GestureRoleConfig:
    gate_on: list[str] = field(default_factory=lambda: ["Open_Palm"])
    gate_off: list[str] = field(default_factory=lambda: ["Closed_Fist", "None"])
    pitch_hand: bool = False
    octave_up: list[str] = field(default_factory=list)
    octave_down: list[str] = field(default_factory=list)


@dataclass
class ScaleConfig:
    name: str = "pentatonic"
    root: str = "C4"
    hysteresis: float = 0.04
    zone_ratio: float = 0.55


@dataclass
class PairVolumeConfig:
    volume_dist_min: float | None = None
    volume_dist_max: float | None = None


@dataclass
class InstrumentConfig:
    preset: str = "scale_gate"
    smoothing_alpha: float = 0.35
    dead_zone: float = 0.06
    role_left: HandRole = field(default_factory=HandRole)
    role_right: HandRole = field(default_factory=HandRole)
    gesture_role_left: GestureRoleConfig = field(default_factory=GestureRoleConfig)
    gesture_role_right: GestureRoleConfig = field(default_factory=GestureRoleConfig)
    scale: ScaleConfig = field(default_factory=ScaleConfig)
    pair_volume: PairVolumeConfig = field(default_factory=PairVolumeConfig)
    gesture_triggers: dict[str, dict[str, Any]] = field(default_factory=dict)
    presets: dict[str, dict[str, str]] = field(default_factory=dict)


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)


def _section(data: dict[str, Any], key: str) -> dict[str, Any]:
    """Seção YAML ausente ou null (ex.: só comentários) → dict vazio."""
    value = data.get(key)
    return value if isinstance(value, dict) else {}


def _parse_role(data: dict[str, Any] | None) -> HandRole:
    if not data:
        return HandRole()
    return HandRole(
        pitch_axis=str(data.get("pitch_axis", "y")),
        pan_axis=str(data.get("pan_axis", "x")),
        mod_axis=str(data.get("mod_axis", "z")),
    )


def _parse_gesture_role(data: dict[str, Any] | None, default_pitch: bool) -> GestureRoleConfig:
    if not data:
        return GestureRoleConfig(pitch_hand=default_pitch)
    return GestureRoleConfig(
        gate_on=list(data.get("gate_on", ["Open_Palm"])),
        gate_off=list(data.get("gate_off", ["Closed_Fist", "None"])),
        pitch_hand=bool(data.get("pitch_hand", default_pitch)),
        octave_up=list(data.get("octave_up", [])),
        octave_down=list(data.get("octave_down", [])),
    )


def load_instrument_config(path: Path | None = None) -> InstrumentConfig:
    path = path or DEFAULT_INSTRUMENT_PATH
    if not path.exists():
        return InstrumentConfig()

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    smoothing = _section(data, "smoothing")
    roles = _section(data, "roles")
    gesture_roles = _section(data, "gesture_roles")
    scale_data = _section(data, "scale")
    pair_data = _section(data, "pair")

    return InstrumentConfig(
        preset=str(data.get("preset", "scale_gate")),
        smoothing_alpha=float(smoothing.get("alpha", 0.35)),
        dead_zone=float(smoothing.get("dead_zone", 0.06)),
        role_left=_parse_role(roles.get("left")),
        role_right=_parse_role(roles.get("right")),
        gesture_role_left=_parse_gesture_role(gesture_roles.get("left"), False),
        gesture_role_right=_parse_gesture_role(gesture_roles.get("right"), True),
        scale=ScaleConfig(
            name=str(scale_data.get("name", "pentatonic")),
            root=str(scale_data.get("root", "C4")),
            hysteresis=float(scale_data.get("hysteresis", 0.04)),
            zone_ratio=float(scale_data.get("zone_ratio", 0.55)),
        ),
        pair_volume=PairVolumeConfig(
            volume_dist_min=_optional_float(pair_data.get("volume_dist_min")),
            volume_dist_max=_optional_float(pair_data.get("volume_dist_max")),
        ),
        gesture_triggers=dict(data.get("gesture_triggers", {})),
        presets=dict(data.get("presets", {})),
    )
