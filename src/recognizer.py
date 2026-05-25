"""Wrapper MediaPipe GestureRecognizer (LIVE_STREAM), suporte a duas mãos."""

from __future__ import annotations

import threading
from dataclasses import dataclass

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from src.config import AppConfig

@dataclass(frozen=True)
class Landmark:
    x: float
    y: float
    z: float


@dataclass
class HandState:
    gesture: str | None
    score: float
    handedness: str
    landmarks: list[Landmark] | None
    presence: bool = True


@dataclass
class HandsSnapshot:
    left: HandState | None = None
    right: HandState | None = None
    timestamp_ms: int = 0

    def primary(self) -> HandState | None:
        """Mão dominante para modo legado: direita, senão esquerda."""
        if self.right and self.right.presence:
            return self.right
        if self.left and self.left.presence:
            return self.left
        return None


def _empty_hand(handedness: str) -> HandState:
    return HandState(
        gesture=None,
        score=0.0,
        handedness=handedness,
        landmarks=None,
        presence=False,
    )


def hands_to_legacy(snapshot: HandsSnapshot | None) -> "RecognitionSnapshot | None":
    if snapshot is None:
        return None
    hand = snapshot.primary()
    if hand is None or not hand.presence:
        return RecognitionSnapshot(
            gesture=None,
            score=0.0,
            handedness=None,
            landmarks=None,
        )
    return RecognitionSnapshot(
        gesture=hand.gesture,
        score=hand.score,
        handedness=hand.handedness,
        landmarks=hand.landmarks,
    )


@dataclass
class RecognitionSnapshot:
    gesture: str | None
    score: float
    handedness: str | None
    landmarks: list[Landmark] | None


class GestureRecognizerWrapper:
    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._lock = threading.Lock()
        self._snapshot: HandsSnapshot | None = None
        self._recognizer: vision.GestureRecognizer | None = None
        self._last_submit_timestamp_ms = -1
        self._hand_slot_history: list[tuple[str | None, str | None]] = []

    def __enter__(self) -> GestureRecognizerWrapper:
        if not self._config.model_path.exists():
            raise FileNotFoundError(
                f"Modelo não encontrado: {self._config.model_path}\n"
                "Execute: python scripts/download_model.py"
            )

        base_options = mp_python.BaseOptions(
            model_asset_path=str(self._config.model_path)
        )
        options = vision.GestureRecognizerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.LIVE_STREAM,
            num_hands=self._config.num_hands,
            min_hand_detection_confidence=self._config.min_hand_detection_confidence,
            min_hand_presence_confidence=self._config.min_hand_presence_confidence,
            min_tracking_confidence=self._config.min_tracking_confidence,
            result_callback=self._on_result,
        )
        self._recognizer = vision.GestureRecognizer.create_from_options(options)
        self._last_submit_timestamp_ms = -1
        return self

    def __exit__(self, *args: object) -> None:
        if self._recognizer is not None:
            self._recognizer.close()
            self._recognizer = None

    def _monotonic_timestamp_ms(self, timestamp_ms: int) -> int:
        if timestamp_ms <= self._last_submit_timestamp_ms:
            timestamp_ms = self._last_submit_timestamp_ms + 1
        self._last_submit_timestamp_ms = timestamp_ms
        return timestamp_ms

    def submit(self, frame_bgr: object, timestamp_ms: int) -> None:
        if self._recognizer is None:
            return
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = self._monotonic_timestamp_ms(timestamp_ms)
        self._recognizer.recognize_async(mp_image, ts)

    def latest_snapshot(self) -> HandsSnapshot | None:
        with self._lock:
            return self._snapshot

    def _on_result(
        self,
        result: vision.GestureRecognizerResult,
        output_image: mp.Image,
        timestamp_ms: int,
    ) -> None:
        snapshot = self._parse_result(result, timestamp_ms)
        with self._lock:
            self._snapshot = snapshot

    def _parse_hand(
        self,
        index: int,
        result: vision.GestureRecognizerResult,
    ) -> HandState | None:
        if not result.gestures or index >= len(result.gestures):
            return None

        gesture_list = result.gestures[index]
        gesture_name: str | None = None
        score = 0.0
        if gesture_list:
            top = gesture_list[0]
            gesture_name = top.category_name
            score = float(top.score)

        handedness = "Right"
        if result.handedness and index < len(result.handedness):
            hlist = result.handedness[index]
            if hlist:
                handedness = hlist[0].category_name

        landmarks: list[Landmark] | None = None
        if result.hand_landmarks and index < len(result.hand_landmarks):
            lm_list = result.hand_landmarks[index]
            if lm_list:
                landmarks = [
                    Landmark(x=lm.x, y=lm.y, z=lm.z) for lm in lm_list
                ]

        return HandState(
            gesture=gesture_name,
            score=score,
            handedness=handedness,
            landmarks=landmarks,
            presence=True,
        )

    def _assign_slots(
        self, detected: list[HandState]
    ) -> tuple[HandState | None, HandState | None]:
        left: HandState | None = None
        right: HandState | None = None
        unassigned: list[HandState] = []

        for hand in detected:
            if hand.handedness == "Left" and left is None:
                left = hand
            elif hand.handedness == "Right" and right is None:
                right = hand
            else:
                unassigned.append(hand)

        for hand in unassigned:
            if left is None:
                left = HandState(
                    gesture=hand.gesture,
                    score=hand.score,
                    handedness="Left",
                    landmarks=hand.landmarks,
                    presence=True,
                )
            elif right is None:
                right = HandState(
                    gesture=hand.gesture,
                    score=hand.score,
                    handedness="Right",
                    landmarks=hand.landmarks,
                    presence=True,
                )

        if len(detected) == 1 and left is None and right is None:
            only = detected[0]
            slot = self._infer_single_hand_slot()
            if slot == "Right":
                right = HandState(
                    gesture=only.gesture,
                    score=only.score,
                    handedness="Right",
                    landmarks=only.landmarks,
                    presence=True,
                )
            else:
                left = HandState(
                    gesture=only.gesture,
                    score=only.score,
                    handedness="Left",
                    landmarks=only.landmarks,
                    presence=True,
                )

        return left, right

    def _infer_single_hand_slot(self) -> str:
        """Mantém slot da mão única estável entre frames."""
        for prev_left, prev_right in reversed(self._hand_slot_history):
            if prev_left and not prev_right:
                return "Left"
            if prev_right and not prev_left:
                return "Right"
        self._hand_slot_history.append(("Left", None))
        if len(self._hand_slot_history) > 5:
            self._hand_slot_history.pop(0)
        return "Left"

    def _parse_result(
        self,
        result: vision.GestureRecognizerResult,
        timestamp_ms: int,
    ) -> HandsSnapshot:
        if not result.gestures:
            return HandsSnapshot(
                left=_empty_hand("Left"),
                right=_empty_hand("Right"),
                timestamp_ms=timestamp_ms,
            )

        detected: list[HandState] = []
        for i in range(len(result.gestures)):
            hand = self._parse_hand(i, result)
            if hand is not None:
                detected.append(hand)

        left, right = self._assign_slots(detected)
        self._hand_slot_history.append(
            (
                "Left" if left and left.presence else None,
                "Right" if right and right.presence else None,
            )
        )
        if len(self._hand_slot_history) > 5:
            self._hand_slot_history.pop(0)

        return HandsSnapshot(
            left=left or _empty_hand("Left"),
            right=right or _empty_hand("Right"),
            timestamp_ms=timestamp_ms,
        )
