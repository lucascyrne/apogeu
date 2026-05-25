"""Captura de frames da webcam via OpenCV."""

from __future__ import annotations

import time
from typing import Literal

import cv2

from src.camera_probe import CameraProbeResult, find_first_working
from src.config import AppConfig

CameraBackend = Literal["auto", "dshow", "msmf", "any"]

AUTO_CAMERA_INDEX = -1

_WARMUP_ATTEMPTS = 60
_WARMUP_DELAY_S = 0.08
_READ_RETRIES = 8
_READ_RETRY_DELAY_S = 0.04


def _try_warmup(cap: cv2.VideoCapture) -> bool:
    for _ in range(_WARMUP_ATTEMPTS):
        success, frame = cap.read()
        if success and frame is not None and frame.size > 0:
            return True
        time.sleep(_WARMUP_DELAY_S)
    return False


def _apply_resolution(cap: cv2.VideoCapture, width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)


def _apply_buffer_size(cap: cv2.VideoCapture) -> None:
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass


class Camera:
    def __init__(
        self,
        config: AppConfig,
        probe: CameraProbeResult | None = None,
    ) -> None:
        self._config = config
        self._cap: cv2.VideoCapture | None = None
        self._backend_label: str = ""
        self._resolved_index: int = config.camera_index
        self._forced_probe = probe
        self._probe_result: CameraProbeResult | None = probe

    @property
    def backend_label(self) -> str:
        return self._backend_label

    @property
    def resolved_index(self) -> int:
        return self._resolved_index

    def open(self) -> None:
        probe = self._resolve_device()
        if probe is None:
            raise RuntimeError(self._format_not_found_error())

        cap = cv2.VideoCapture(probe.index, probe.backend_id)
        if not cap.isOpened():
            cap.release()
            raise RuntimeError(
                f"Câmera encontrada no teste (índice {probe.index}, {probe.backend_label}) "
                "mas falhou ao reabrir. Execute: hand-gestures --list-cameras"
            )

        _apply_buffer_size(cap)
        if not _try_warmup(cap):
            cap.release()
            raise RuntimeError(
                f"Câmera índice {probe.index} ({probe.backend_label}): warm-up falhou após detecção."
            )

        _apply_resolution(cap, self._config.frame_width, self._config.frame_height)
        _try_warmup(cap)

        self._cap = cap
        self._backend_label = probe.backend_label
        self._resolved_index = probe.index
        self._probe_result = probe

    def _resolve_device(self) -> CameraProbeResult | None:
        if self._forced_probe is not None:
            return self._forced_probe

        idx = self._config.camera_index
        backend: CameraBackend = self._config.camera_backend  # type: ignore[assignment]

        if idx == AUTO_CAMERA_INDEX:
            return find_first_working(backend_preference=backend, preferred_index=None)

        found = find_first_working(
            backend_preference=backend,
            preferred_index=idx,
        )
        if found is not None:
            return found

        if self._config.fallback_scan:
            return find_first_working(backend_preference="auto", preferred_index=None)
        return None

    def _format_not_found_error(self) -> str:
        idx = self._config.camera_index
        lines = [
            "Nenhuma câmera entregou frames válidos.",
            "",
            "Tente:",
            "  hand-gestures --pick-camera",
            "  hand-gestures --list-cameras",
            "  hand-gestures --camera auto",
            "  hand-gestures --camera 1 --camera-backend dshow",
            "",
            "No Windows: Configurações > Privacidade > Câmera — permitir apps desktop.",
            "Drivers: atualize o driver da webcam no Gerenciador de Dispositivos.",
        ]
        if idx >= 0:
            lines.insert(
                1,
                f"Índice solicitado ({idx}) não respondeu em nenhum backend testado.",
            )
        return "\n".join(lines)

    def read(self) -> tuple[bool, object, int]:
        if self._cap is None:
            raise RuntimeError("Câmera não inicializada. Chame open() primeiro.")

        timestamp_ms = int(time.monotonic() * 1000)

        for attempt in range(_READ_RETRIES):
            success, frame = self._cap.read()
            if success and frame is not None and frame.size > 0:
                return True, frame, timestamp_ms
            if attempt < _READ_RETRIES - 1:
                time.sleep(_READ_RETRY_DELAY_S)

        return False, None, timestamp_ms

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
