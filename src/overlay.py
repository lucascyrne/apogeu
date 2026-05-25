"""Overlay visual: tracking, HUD e guia de gestos."""

from __future__ import annotations

import cv2
import numpy as np

from src.events import ControlFrameEvent
from src.gestures import GESTURE_CHEATSHEET
from src.mapping.scale import scale_size
from src.recognizer import HandsSnapshot, Landmark, hands_to_legacy

HAND_CONNECTIONS: tuple[tuple[int, int], ...] = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12),
    (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20),
    (5, 9), (9, 13), (13, 17),
)
FINGER_TIPS = (4, 8, 12, 16, 20)
FONT = cv2.FONT_HERSHEY_SIMPLEX
COLOR_LEFT = (255, 140, 0)
COLOR_RIGHT = (0, 210, 255)
COLOR_DEFAULT = (80, 255, 160)
COLOR_ACTIVE = (255, 255, 255)
COLOR_DIM = (140, 140, 140)
COLOR_PANEL = (24, 24, 24)
COLOR_TRACK_FILL = (40, 40, 40)
GUIDE_W = 168
BAR_W = 12


def _hand_color(handedness: str | None) -> tuple[int, int, int]:
    if handedness == "Left":
        return COLOR_LEFT
    if handedness == "Right":
        return COLOR_RIGHT
    return COLOR_DEFAULT


def _draw_hand_tracking(
    frame: np.ndarray,
    landmarks: list[Landmark],
    handedness: str | None,
    active: bool,
) -> None:
    h, w = frame.shape[:2]
    color = _hand_color(handedness)
    points = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    pad = int(0.08 * max(w, h))
    x1, y1 = max(0, min(xs) - pad), max(0, min(ys) - pad)
    x2, y2 = min(w - 1, max(xs) + pad), min(h - 1, max(ys) + pad)
    box_color = COLOR_ACTIVE if active else color
    thickness = 3 if active else 2
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), box_color, thickness, cv2.LINE_AA)
    cv2.addWeighted(overlay, 0.35, frame, 0.65, 0, frame)
    for i, j in HAND_CONNECTIONS:
        if i < len(points) and j < len(points):
            cv2.line(frame, points[i], points[j], color, 2, cv2.LINE_AA)
    if len(points) > 17:
        palm = np.array([points[0], points[5], points[9], points[13], points[17]], np.int32)
        cv2.fillPoly(frame, [palm], COLOR_TRACK_FILL, lineType=cv2.LINE_AA)
    for idx, pt in enumerate(points):
        if idx in FINGER_TIPS:
            cv2.rectangle(frame, (pt[0] - 5, pt[1] - 5), (pt[0] + 5, pt[1] + 5), box_color, 2)
        else:
            cv2.circle(frame, pt, 4, color, -1, lineType=cv2.LINE_AA)


def _draw_vbar(
    frame: np.ndarray,
    x: int,
    y: int,
    bar_h: int,
    value: float,
    color: tuple[int, int, int],
) -> None:
    cv2.rectangle(frame, (x, y), (x + BAR_W, y + bar_h), (50, 50, 50), -1)
    fill_h = int(bar_h * max(0.0, min(1.0, value)))
    if fill_h > 0:
        cv2.rectangle(frame, (x, y + bar_h - fill_h), (x + BAR_W, y + bar_h), color, -1)


def _draw_hand_control_row(
    frame: np.ndarray,
    y: int,
    label: str,
    color: tuple[int, int, int],
    presence: bool,
    pitch: float,
    degree: int | None,
) -> int:
    """Uma linha do painel musical; retorna próximo y."""
    if not presence:
        cv2.putText(
            frame,
            f"{label}: ausente",
            (12, y),
            FONT,
            0.42,
            COLOR_DIM,
            1,
            cv2.LINE_AA,
        )
        return y + 22

    deg_txt = f"  zona {degree + 1}" if degree is not None else ""
    text = f"{label}: Y {pitch:.2f}{deg_txt}"
    cv2.putText(frame, text, (12, y), FONT, 0.42, color, 1, cv2.LINE_AA)
    _draw_vbar(frame, 220, y - 14, 36, pitch, color)
    return y + 26


def _draw_scale_zones(
    frame: np.ndarray,
    y_top: int,
    y_bottom: int,
    x0: int,
    x1: int,
    n: int,
) -> None:
    """Faixas da escala na área de vídeo (não sobre o painel de texto)."""
    if n <= 0 or y_bottom <= y_top:
        return
    for i in range(n + 1):
        y = y_top + int((y_bottom - y_top) * (1.0 - i / n))
        cv2.line(frame, (x0, y), (x1, y), COLOR_DIM, 1, cv2.LINE_AA)


def _draw_musical_hud(
    frame: np.ndarray,
    control: ControlFrameEvent | None,
    active_gesture: str,
    fps: float,
) -> None:
    h, w = frame.shape[:2]
    preset = control.preset if control else "theremin"
    line = f"{preset}  |  {active_gesture or '—'}  |  {fps:.0f} FPS"
    (tw, th), _ = cv2.getTextSize(line, FONT, 0.55, 2)
    cv2.rectangle(frame, (0, 0), (w, th + 14), COLOR_PANEL, -1)
    cv2.putText(frame, line, (8, th + 6), FONT, 0.55, COLOR_ACTIVE, 1, cv2.LINE_AA)

    panel_h = 118
    py0 = h - panel_h
    cv2.rectangle(frame, (0, py0), (w - GUIDE_W, h), COLOR_PANEL, -1)
    cv2.putText(
        frame,
        f"Instrumento: {preset}",
        (10, py0 + 20),
        FONT,
        0.45,
        COLOR_ACTIVE,
        1,
        cv2.LINE_AA,
    )

    if control is None:
        cv2.putText(
            frame,
            "Aguardando controle...",
            (10, py0 + 48),
            FONT,
            0.42,
            COLOR_DIM,
            1,
            cv2.LINE_AA,
        )
        return

    n_zones = scale_size(control.scale)
    strip_w = 36
    strip_x1 = w - GUIDE_W - 12
    strip_x0 = strip_x1 - strip_w
    _draw_scale_zones(frame, 40, py0 - 6, strip_x0, strip_x1, n_zones)

    y = py0 + 42
    y = _draw_hand_control_row(
        frame, y, "Esq", COLOR_LEFT, control.left.presence,
        control.left.pitch_norm, None,
    )
    y = _draw_hand_control_row(
        frame, y, "Dir", COLOR_RIGHT, control.right.presence,
        control.right.pitch_norm, control.right.scale_degree,
    )

    vol = control.pair.volume_master
    vol_mode = "V segurar" if control.pair.volume_active else "V solto"
    cv2.putText(
        frame,
        f"Volume: {vol:.0%}  ({vol_mode})",
        (10, y + 4),
        FONT,
        0.42,
        COLOR_ACTIVE,
        1,
        cv2.LINE_AA,
    )
    _draw_vbar(frame, 220, y - 10, 28, vol, COLOR_ACTIVE)

    gate = "GATE ON" if control.right.gate_open else "gate off"
    cv2.putText(
        frame,
        f"Y=nota  {gate}  {control.scale}  Victory=segurar p/ volume",
        (10, h - 10),
        FONT,
        0.35,
        COLOR_DIM,
        1,
        cv2.LINE_AA,
    )

    if control.left.presence and control.right.presence:
        lx = int(control.left.x * (w - GUIDE_W))
        ly = int(control.left.y * (h - panel_h))
        rx = int(control.right.x * (w - GUIDE_W))
        ry = int(control.right.y * (h - panel_h))
        cv2.line(frame, (lx, ly), (rx, ry), COLOR_ACTIVE, 2, cv2.LINE_AA)
        mid_x = (lx + rx) // 2
        mid_y = (ly + ry) // 2
        dist_txt = f"dist {control.pair.hands_distance:.2f}"
        cv2.putText(
            frame, dist_txt, (mid_x - 30, mid_y - 8),
            FONT, 0.4, COLOR_ACTIVE, 1, cv2.LINE_AA,
        )


def _draw_gesture_guide(frame: np.ndarray, active_gesture: str) -> None:
    h, w = frame.shape[:2]
    x0 = w - GUIDE_W
    cv2.rectangle(frame, (x0, 0), (w, h), COLOR_PANEL, -1)
    y = 28
    cv2.putText(frame, "Gestos", (x0 + 10, y), FONT, 0.5, COLOR_DIM, 1)
    y += 26
    for gid, label in GESTURE_CHEATSHEET:
        active = gid == active_gesture
        color = COLOR_ACTIVE if active else (180, 180, 180)
        prefix = ">" if active else " "
        cv2.putText(frame, f"{prefix} {label}", (x0 + 8, y), FONT, 0.42, color, 1)
        y += 22
    cv2.putText(frame, "q sair", (x0 + 10, h - 12), FONT, 0.38, COLOR_DIM, 1)


def render_frame(
    frame_bgr: object,
    snapshot: HandsSnapshot | None,
    stable_gesture: str,
    stable_score: float,
    stable_handedness: str | None,
    fps: float,
    musical: bool = False,
    control: ControlFrameEvent | None = None,
) -> object:
    display = np.asarray(frame_bgr).copy()
    active = stable_gesture if stable_gesture != "None" else ""

    if snapshot:
        for hand, label in ((snapshot.left, "Left"), (snapshot.right, "Right")):
            if hand and hand.presence and hand.landmarks:
                is_active = musical and (
                    (label == "Left" and snapshot.left and snapshot.left.gesture == active)
                    or (label == "Right" and snapshot.right and snapshot.right.gesture == active)
                    or (active and hand.gesture == active)
                )
                _draw_hand_tracking(display, hand.landmarks, label, bool(active) and is_active)

    if musical:
        _draw_musical_hud(display, control, active, fps)
    else:
        legacy = hands_to_legacy(snapshot)
        from src.recognizer import RecognitionSnapshot

        _draw_legacy_hud(display, stable_gesture, stable_score, stable_handedness, legacy, fps)

    _draw_gesture_guide(display, active)
    return display


def _draw_legacy_hud(
    frame: np.ndarray,
    stable_gesture: str,
    stable_score: float,
    stable_handedness: str | None,
    snapshot: object,
    fps: float,
) -> None:
    h, w = frame.shape[:2]
    lines = [
        f"Gesto: {stable_gesture}",
        f"Score: {stable_score:.2f}",
        f"Mao: {stable_handedness or '-'}",
        f"FPS: {fps:.1f}",
    ]
    y = 28
    for line in lines:
        cv2.putText(frame, line, (12, y), FONT, 0.55, COLOR_ACTIVE, 1)
        y += 26
