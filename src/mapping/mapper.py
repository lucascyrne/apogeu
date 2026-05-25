"""Features suavizadas → ControlFrameEvent."""

from __future__ import annotations

from src.events import ControlFrameEvent, HandControl, PairControl
from src.expression.distance import DistanceCalibrator
from src.expression.engine import SmoothedFrame, SmoothedHandFeatures
from src.expression.presence import PresenceHold
from src.mapping.gate_latch import GateLatch
from src.mapping.loader import HandRole, InstrumentConfig
from src.mapping.scale import (
    ScaleQuantizer,
    degree_to_scale_midi,
    scale_size,
)

DEFAULT_VOLUME = 0.75
VICTORY_GESTURE = "Victory"
EDGE = 0.02
RELEASE_LOW = 0.06
GATE_RESET_FRAMES = 5


def _axis_value(hand: SmoothedHandFeatures, axis: str) -> float:
    if axis == "x":
        return hand.x_norm
    if axis == "z":
        return hand.z_norm
    return hand.y_norm


class GestureMapper:
    def __init__(self, config: InstrumentConfig) -> None:
        self._config = config
        self._preset = config.preset
        self._scale_name = config.scale.name
        self._octave_shift = 0
        self._last_volume = DEFAULT_VOLUME
        self._last_pitch_midi: float | None = None
        self._last_hands_distance = 0.0
        self._right_gate = GateLatch(
            config.gesture_role_right.gate_on,
            config.gesture_role_right.gate_off,
        )
        self._right_presence = PresenceHold(hold_frames=8)
        self._victory_hold = PresenceHold(hold_frames=3)
        self._distance = DistanceCalibrator(
            config.pair_volume.volume_dist_min,
            config.pair_volume.volume_dist_max,
        )
        self._pitch_quantizer = ScaleQuantizer(
            config.scale.name,
            config.scale.hysteresis,
        )
        self._edge_lock: str | None = None
        self._last_published_degree: int | None = None
        self._gate_closed_frames = 0

    @property
    def preset(self) -> str:
        return self._preset

    @property
    def scale_name(self) -> str:
        return self._scale_name

    def apply_octave_shift(self, delta: int) -> None:
        self._octave_shift = max(-2, min(2, self._octave_shift + delta))

    def map_frame(
        self,
        smoothed: SmoothedFrame,
        timestamp_ms: int,
        left_gesture: str = "None",
        right_gesture: str = "None",
        right_gesture_stable: str = "None",
    ) -> ControlFrameEvent:
        right = self._map_pitch_hand(
            smoothed.right, right_gesture, right_gesture_stable
        )
        left = self._map_hand(
            smoothed.left,
            self._config.role_left,
            left_gesture,
            pitch_hand=False,
        )

        gate_open = right.gate_open
        vol_active = self._victory_hold.update(right_gesture == VICTORY_GESTURE)
        vol = self._volume_for_pair(smoothed, gate_open, vol_active, timestamp_ms)

        return ControlFrameEvent(
            timestamp_ms=timestamp_ms,
            preset=self._preset,
            scale=self._scale_name,
            left=left,
            right=right,
            pair=PairControl(
                hands_distance=smoothed.hands_distance,
                volume_master=vol,
                spread=smoothed.spread,
                volume_active=vol_active,
            ),
        )

    def _volume_for_pair(
        self,
        smoothed: SmoothedFrame,
        gate_open: bool,
        vol_active: bool,
        timestamp_ms: int,
    ) -> float:
        if not gate_open:
            return 0.0
        if not vol_active:
            return self._last_volume

        if smoothed.left.presence and smoothed.right.presence:
            dist = smoothed.hands_distance
            self._last_hands_distance = dist
        else:
            dist = self._last_hands_distance

        vol = self._distance.map(dist, True, timestamp_ms)
        self._last_volume = vol
        return vol

    def _map_pitch_hand(
        self,
        hand: SmoothedHandFeatures,
        gesture: str,
        gate_gesture_stable: str,
    ) -> HandControl:
        role = self._config.role_right
        pitch_norm = _axis_value(hand, role.pitch_axis)

        gate = self._right_gate.update(gesture, hand.presence, gate_gesture_stable)

        presence = hand.presence
        if self._preset == "scale_gate":
            presence = True if gate else self._right_presence.update(hand.presence)

        pitch_midi: float | None = None
        degree: int | None = None

        if self._preset == "scale_gate":
            if not gate:
                self._gate_closed_frames += 1
                if self._gate_closed_frames >= GATE_RESET_FRAMES:
                    self._pitch_quantizer.reset()
                    self._edge_lock = None
                    self._last_published_degree = None
            else:
                self._gate_closed_frames = 0

        if self._preset == "scale_gate" and (presence or gate):
            if gate:
                degree = self._resolve_pitch_degree(pitch_norm)
                self._pitch_quantizer.sync_degree(degree)
                pitch_midi = degree_to_scale_midi(
                    degree, self._scale_name, self._octave_shift
                )
                self._last_pitch_midi = pitch_midi
                self._last_published_degree = degree
            elif self._last_pitch_midi is not None:
                pitch_midi = self._last_pitch_midi
                degree = self._last_published_degree

        sx = getattr(hand, "spatial_x", hand.x_norm)
        sy = getattr(hand, "spatial_y", hand.y_norm)

        return HandControl(
            presence=presence or gate,
            x=sx,
            y=sy,
            z=hand.z_norm,
            pan=0.0,
            pitch_norm=pitch_norm,
            mod=0.0,
            gesture=gesture if gesture != "None" else None,
            gate_open=gate,
            scale_degree=degree,
        )

    def _map_hand(
        self,
        hand: SmoothedHandFeatures,
        role: HandRole,
        gesture: str,
        pitch_hand: bool,
    ) -> HandControl:
        pitch_norm = _axis_value(hand, role.pitch_axis)
        sx = getattr(hand, "spatial_x", hand.x_norm)
        sy = getattr(hand, "spatial_y", hand.y_norm)
        return HandControl(
            presence=hand.presence,
            x=sx,
            y=sy,
            z=hand.z_norm,
            pan=0.0,
            pitch_norm=pitch_norm,
            mod=0.0,
            gesture=gesture if gesture != "None" else None,
            gate_open=False,
            scale_degree=None,
        )

    def _resolve_pitch_degree(self, pitch_norm: float) -> int:
        n = scale_size(self._scale_name)
        max_deg = max(0, n - 1)
        release_high = 0.5 - EDGE if max_deg > 1 else 1.0 - EDGE

        if pitch_norm <= EDGE:
            self._edge_lock = "low"
        elif self._edge_lock == "low" and pitch_norm > RELEASE_LOW:
            self._edge_lock = None

        if pitch_norm >= 1.0 - EDGE:
            self._edge_lock = "high"
        elif self._edge_lock == "high" and pitch_norm < release_high:
            self._edge_lock = None

        if self._edge_lock == "low":
            return 0
        if self._edge_lock == "high":
            return max_deg

        return self._pitch_quantizer.quantize(pitch_norm)

    def gesture_action(self, gesture: str, hand: str | None) -> dict | None:
        trigger = self._config.gesture_triggers.get(gesture)
        if not trigger:
            return None
        th = str(trigger.get("hand", "any")).lower()
        if th != "any" and hand and th != hand.lower():
            return None
        return trigger
