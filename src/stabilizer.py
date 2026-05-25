"""Estabilização temporal de gestos (uma ou duas mãos)."""

from __future__ import annotations

from collections import Counter, deque

from src.config import AppConfig
from src.events import GestureEvent
from src.recognizer import HandState, HandsSnapshot, hands_to_legacy


class _SingleHandStabilizer:
    def __init__(self, config: AppConfig, hand_label: str) -> None:
        self._config = config
        self._hand_label = hand_label
        self._buffer: deque[str] = deque(maxlen=config.vote_window)
        self._stable_gesture: str = "None"
        self._stable_score: float = 0.0
        self._last_emit_ms: int = 0
        self._consecutive_count: int = 0
        self._last_voted: str = "None"

    @property
    def current_gesture(self) -> str:
        return self._stable_gesture

    @property
    def current_score(self) -> float:
        return self._stable_score

    @property
    def live_gesture(self) -> str:
        """Moda do buffer (gesto atual por frame, para gate)."""
        return self._majority_vote()

    def update(self, hand: HandState | None, timestamp_ms: int) -> GestureEvent | None:
        raw_gesture = "None"
        raw_score = 0.0

        if hand is not None and hand.presence and hand.gesture:
            raw_gesture = hand.gesture
            raw_score = hand.score

        if raw_score < self._config.score_threshold:
            raw_gesture = "None"
            raw_score = 0.0

        self._buffer.append(raw_gesture)
        voted = self._majority_vote()

        if voted == self._last_voted:
            self._consecutive_count += 1
        else:
            self._last_voted = voted
            self._consecutive_count = 1

        if (
            self._consecutive_count < self._config.min_consecutive
            or voted == self._stable_gesture
        ):
            return None

        elapsed = timestamp_ms - self._last_emit_ms
        if self._last_emit_ms > 0 and elapsed < self._config.cooldown_ms:
            return None

        self._stable_gesture = voted
        self._stable_score = raw_score if voted != "None" else 0.0
        self._last_emit_ms = timestamp_ms

        return GestureEvent(
            gesture=self._stable_gesture,
            score=self._stable_score,
            handedness=self._hand_label,
            timestamp_ms=timestamp_ms,
            schema_version="2",
            hand=self._hand_label,
        )

    def _majority_vote(self) -> str:
        if not self._buffer:
            return "None"
        return Counter(self._buffer).most_common(1)[0][0]


class GestureStabilizer:
    """Legado: uma mão via snapshot único."""

    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._single = _SingleHandStabilizer(config, "Right")
        self._left = _SingleHandStabilizer(config, "Left")
        self._right = _SingleHandStabilizer(config, "Right")
        self._musical = config.musical

    @property
    def current_gesture(self) -> str:
        if self._musical:
            r, l = self._right.current_gesture, self._left.current_gesture
            return r if r != "None" else l
        return self._single.current_gesture

    @property
    def current_score(self) -> float:
        if self._musical:
            return max(self._right.current_score, self._left.current_score)
        return self._single.current_score

    @property
    def left_gesture(self) -> str:
        if self._musical:
            return self._left.live_gesture
        return self._single.live_gesture

    @property
    def right_gesture(self) -> str:
        if self._musical:
            return self._right.live_gesture
        return self._single.live_gesture

    @property
    def right_gesture_stable(self) -> str:
        """Gesto estabilizado da mão direita (para gate latch)."""
        if self._musical:
            return self._right.current_gesture
        return self._single.current_gesture

    @property
    def current_handedness(self) -> str | None:
        if self._musical:
            if self._right.current_gesture != "None":
                return "Right"
            if self._left.current_gesture != "None":
                return "Left"
            return None
        return "Right"

    def update(
        self, snapshot: HandsSnapshot | None, timestamp_ms: int
    ) -> GestureEvent | list[GestureEvent] | None:
        if self._musical:
            events: list[GestureEvent] = []
            if snapshot:
                ev_l = self._left.update(snapshot.left, timestamp_ms)
                ev_r = self._right.update(snapshot.right, timestamp_ms)
                if ev_l:
                    events.append(ev_l)
                if ev_r:
                    events.append(ev_r)
            return events if events else None

        legacy = hands_to_legacy(snapshot)

        if legacy is None:
            return self._single.update(None, timestamp_ms)

        hand_state = HandState(
            gesture=legacy.gesture,
            score=legacy.score,
            handedness=legacy.handedness or "Right",
            landmarks=legacy.landmarks,
            presence=legacy.gesture is not None,
        )
        return self._single.update(hand_state, timestamp_ms)
