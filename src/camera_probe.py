"""Descoberta e teste de câmeras disponíveis (OpenCV)."""

from __future__ import annotations

import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator, Literal

import cv2

CameraBackend = Literal["auto", "dshow", "msmf", "any"]

_WINDOWS_BACKENDS: list[tuple[int, str]] = [
    (cv2.CAP_DSHOW, "DirectShow"),
    (cv2.CAP_MSMF, "Media Foundation"),
    (cv2.CAP_ANY, "padrão"),
]

MAX_PROBE_INDEX = 10
_CONSECUTIVE_EMPTY_STOP = 3
_PROBE_READ_ATTEMPTS = 20
_PROBE_DELAY_S = 0.08


def backend_candidates(preference: CameraBackend) -> list[tuple[int, str]]:
    if sys.platform != "win32":
        return [(cv2.CAP_ANY, "padrão")]

    if preference == "dshow":
        return [(cv2.CAP_DSHOW, "DirectShow")]
    if preference == "msmf":
        return [(cv2.CAP_MSMF, "Media Foundation")]
    if preference == "any":
        return [(cv2.CAP_ANY, "padrão")]
    return list(_WINDOWS_BACKENDS)


def all_windows_backends() -> list[tuple[int, str]]:
    """DSHOW + MSMF apenas (evita CAP_ANY / obsensor em índices inválidos)."""
    seen: set[int] = set()
    out: list[tuple[int, str]] = []
    for bid, label in backend_candidates("dshow") + backend_candidates("msmf"):
        if bid not in seen:
            seen.add(bid)
            out.append((bid, label))
    return out


@contextmanager
def _suppress_opencv_probe_logs() -> Iterator[None]:
    """Reduz ruído do OpenCV durante varredura (compatível com builds sem getLogLevel)."""
    if not hasattr(cv2, "setLogLevel"):
        yield
        return
    silent = getattr(cv2, "LOG_LEVEL_SILENT", 0)
    default = getattr(cv2, "LOG_LEVEL_WARNING", 2)
    try:
        cv2.setLogLevel(silent)
        yield
    finally:
        try:
            cv2.setLogLevel(default)
        except Exception:
            pass


@dataclass(frozen=True)
class CameraProbeResult:
    index: int
    backend_id: int
    backend_label: str
    width: int
    height: int
    ok: bool
    detail: str


def probe_camera(
    index: int,
    backend_id: int,
    backend_label: str,
) -> CameraProbeResult:
    cap = cv2.VideoCapture(index, backend_id)
    if not cap.isOpened():
        cap.release()
        return CameraProbeResult(
            index=index,
            backend_id=backend_id,
            backend_label=backend_label,
            width=0,
            height=0,
            ok=False,
            detail="não abriu",
        )

    try:
        for _ in range(_PROBE_READ_ATTEMPTS):
            success, frame = cap.read()
            if success and frame is not None and frame.size > 0:
                height, width = frame.shape[:2]
                return CameraProbeResult(
                    index=index,
                    backend_id=backend_id,
                    backend_label=backend_label,
                    width=width,
                    height=height,
                    ok=True,
                    detail=f"{width}x{height}",
                )
            time.sleep(_PROBE_DELAY_S)
    finally:
        cap.release()

    return CameraProbeResult(
        index=index,
        backend_id=backend_id,
        backend_label=backend_label,
        width=0,
        height=0,
        ok=False,
        detail="abriu mas sem frame",
    )


def scan_cameras(
    backend_preference: CameraBackend = "auto",
    max_index: int = MAX_PROBE_INDEX,
) -> list[CameraProbeResult]:
    results: list[CameraProbeResult] = []
    if backend_preference == "auto" and sys.platform == "win32":
        backends = all_windows_backends()
    else:
        backends = backend_candidates(backend_preference)

    consecutive_empty = 0
    with _suppress_opencv_probe_logs():
        for index in range(max_index):
            index_had_success = False
            for backend_id, backend_label in backends:
                result = probe_camera(index, backend_id, backend_label)
                results.append(result)
                if result.ok:
                    index_had_success = True
                if result.ok and backend_preference != "auto":
                    return results
            if index_had_success:
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                if consecutive_empty >= _CONSECUTIVE_EMPTY_STOP:
                    break
    return results


def find_first_working(
    backend_preference: CameraBackend = "auto",
    preferred_index: int | None = None,
    max_index: int = MAX_PROBE_INDEX,
) -> CameraProbeResult | None:
    """Retorna a primeira câmera que entrega frames válidos."""
    if preferred_index is not None and preferred_index >= 0:
        to_try = (
            all_windows_backends()
            if backend_preference == "auto" and sys.platform == "win32"
            else backend_candidates(backend_preference)
        )
        for backend_id, backend_label in to_try:
            result = probe_camera(preferred_index, backend_id, backend_label)
            if result.ok:
                return result

    all_results = scan_cameras(backend_preference="auto", max_index=max_index)
    working = [r for r in all_results if r.ok]
    if not working:
        return None

    if preferred_index is not None and preferred_index >= 0:
        for r in working:
            if r.index == preferred_index:
                return r

    def sort_key(r: CameraProbeResult) -> tuple:
        dshow_bonus = 0 if r.backend_label == "DirectShow" else 1
        return (dshow_bonus, r.index, r.backend_id)

    working.sort(key=sort_key)
    return working[0]


def list_usable_cameras(max_index: int = MAX_PROBE_INDEX) -> list[CameraProbeResult]:
    """Uma entrada por índice de câmera que entrega frames (melhor backend por índice)."""
    results = scan_cameras(backend_preference="auto", max_index=max_index)
    working = [r for r in results if r.ok]
    by_index: dict[int, CameraProbeResult] = {}
    for result in working:
        current = by_index.get(result.index)
        if current is None:
            by_index[result.index] = result
            continue
        if (
            result.backend_label == "DirectShow"
            and current.backend_label != "DirectShow"
        ):
            by_index[result.index] = result
    return sorted(by_index.values(), key=lambda r: r.index)
