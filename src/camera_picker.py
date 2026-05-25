"""Seletor visual de câmera (OpenCV) com pré-visualização ao vivo."""

from __future__ import annotations

import time

import cv2
import numpy as np

from src.camera_probe import CameraProbeResult, list_usable_cameras
from src.events import emit_stderr

WINDOW_NAME = "Selecionar camera - Hand Gestures"
_PANEL_WIDTH = 320
_FONT = cv2.FONT_HERSHEY_SIMPLEX

# Teclas de seta (waitKeyEx) em Windows / Linux
_ARROW_LEFT = (81, 2, 65361, 2424832)
_ARROW_RIGHT = (83, 3, 65363, 2555904)
_ARROW_UP = (82, 0, 65362, 2490368)
_ARROW_DOWN = (84, 1, 65364, 2621440)


def _draw_ui(
    frame: np.ndarray,
    options: list[CameraProbeResult],
    selected: int,
) -> np.ndarray:
    h, w = frame.shape[:2]
    panel = np.zeros((h, _PANEL_WIDTH, 3), dtype=np.uint8)
    panel[:] = (32, 32, 32)

    y = 28
    cv2.putText(
        panel,
        "Escolha a camera",
        (12, y),
        _FONT,
        0.55,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )
    y += 36

    if not options:
        cv2.putText(
            panel,
            "Nenhuma detectada",
            (12, y),
            _FONT,
            0.5,
            (100, 100, 255),
            1,
            cv2.LINE_AA,
        )
        y += 24
        for line in (
            "R: buscar de novo",
            "Verifique USB e",
            "permissao Windows.",
            "ESC: sair",
        ):
            cv2.putText(
                panel, line, (12, y), _FONT, 0.45, (180, 180, 180), 1, cv2.LINE_AA
            )
            y += 22
    else:
        for i, opt in enumerate(options):
            active = i == selected
            color = (80, 220, 120) if active else (200, 200, 200)
            prefix = ">" if active else " "
            label = f"{prefix} [{i + 1}] Indice {opt.index}"
            cv2.putText(panel, label, (12, y), _FONT, 0.48, color, 1, cv2.LINE_AA)
            y += 22
            sub = f"    {opt.backend_label} {opt.detail}"
            cv2.putText(
                panel, sub, (12, y), _FONT, 0.4, (140, 140, 140), 1, cv2.LINE_AA
            )
            y += 24

    y = h - 140
    for line in (
        "N / P ou setas: trocar",
        "1-9: atalho",
        "R: atualizar lista",
        "ENTER: confirmar",
        "ESC: cancelar",
    ):
        cv2.putText(
            panel, line, (12, y), _FONT, 0.42, (160, 160, 160), 1, cv2.LINE_AA
        )
        y += 22

    preview = frame.copy()
    if options:
        bar = (
            f"Camera {options[selected].index} | "
            f"{options[selected].backend_label} | {options[selected].detail}"
        )
        cv2.rectangle(preview, (0, 0), (w, 32), (0, 0, 0), -1)
        cv2.putText(
            preview, bar, (8, 22), _FONT, 0.55, (255, 255, 255), 1, cv2.LINE_AA
        )

    return np.hstack([panel, preview])


def _blank_frame(message: str) -> np.ndarray:
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(
        frame, message, (80, 240), _FONT, 0.7, (100, 100, 255), 2, cv2.LINE_AA
    )
    return frame


def pick_camera_interactive(max_index: int = 10) -> CameraProbeResult | None:
    """
    Abre janela com lista de câmeras e preview ao vivo.
    Retorna a câmera escolhida ou None se o usuário cancelar.
    """
    emit_stderr("Abrindo seletor de camera (varredura pode levar alguns segundos)...")
    options = list_usable_cameras(max_index=max_index)

    selected = 0
    cap: cv2.VideoCapture | None = None
    active_probe: CameraProbeResult | None = None

    def release_cap() -> None:
        nonlocal cap, active_probe
        if cap is not None:
            cap.release()
            cap = None
        active_probe = None

    def open_preview(probe: CameraProbeResult) -> bool:
        nonlocal cap, active_probe
        release_cap()
        cap = cv2.VideoCapture(probe.index, probe.backend_id)
        if not cap.isOpened():
            release_cap()
            return False
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass
        for _ in range(20):
            ok, _ = cap.read()
            if ok:
                active_probe = probe
                return True
            time.sleep(0.05)
        release_cap()
        return False

    def refresh_options() -> None:
        nonlocal options, selected
        release_cap()
        emit_stderr("Varrendo cameras novamente...")
        options = list_usable_cameras(max_index=max_index)
        if options:
            selected = min(selected, len(options) - 1)
            open_preview(options[selected])
        else:
            selected = 0

    def select_index(idx: int) -> None:
        nonlocal selected
        if not options:
            return
        selected = idx % len(options)
        open_preview(options[selected])

    if options:
        open_preview(options[0])

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 960, 540)

    try:
        while True:
            frame = _blank_frame("Sem sinal na preview")
            if options and cap is not None and active_probe == options[selected]:
                ok, live = cap.read()
                if ok and live is not None and live.size > 0:
                    frame = live

            display = _draw_ui(frame, options, selected)
            cv2.imshow(WINDOW_NAME, display)

            key_raw = cv2.waitKeyEx(30)
            if key_raw == -1:
                continue
            key = key_raw & 0xFF

            if key in (27, ord("q")):
                return None
            if key in (13, 32) and options:
                return options[selected]
            if key in (ord("r"), ord("R")):
                refresh_options()
                continue
            if key in (ord("n"), ord("N"), ord("]")) or key_raw in _ARROW_RIGHT + _ARROW_DOWN:
                select_index(selected + 1)
                continue
            if key in (ord("p"), ord("P"), ord("[")) or key_raw in _ARROW_LEFT + _ARROW_UP:
                select_index(selected - 1)
                continue
            if ord("1") <= key <= ord("9") and options:
                idx = key - ord("1")
                if idx < len(options):
                    select_index(idx)
    finally:
        release_cap()
        try:
            cv2.destroyWindow(WINDOW_NAME)
        except cv2.error:
            cv2.destroyAllWindows()

    return None


def probe_to_backend_flag(probe: CameraProbeResult) -> str:
    if probe.backend_label == "DirectShow":
        return "dshow"
    if probe.backend_label == "Media Foundation":
        return "msmf"
    return "any"
