"""Configuração padrão e resolução de caminhos."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "gesture_recognizer.task"
DEFAULT_INSTRUMENT_PATH = PROJECT_ROOT / "config" / "default-instrument.yaml"


@dataclass
class AppConfig:
    model_path: Path = DEFAULT_MODEL_PATH
    camera_index: int = -1
    frame_width: int = 640
    frame_height: int = 480

    num_hands: int = 1
    min_hand_detection_confidence: float = 0.5
    min_hand_presence_confidence: float = 0.5
    min_tracking_confidence: float = 0.5

    vote_window: int = 8
    min_consecutive: int = 5
    cooldown_ms: int = 300
    score_threshold: float = 0.6

    with_landmarks: bool = False
    window_name: str = "Hand Gestures"
    camera_backend: str = "auto"
    fallback_scan: bool = True
    max_read_failures: int = 30
    pick_camera: bool = False
    no_pick_camera: bool = False

    # Modo musical (Fase 2)
    musical: bool = False
    instrument_config: Path = DEFAULT_INSTRUMENT_PATH
    emit_rate_hz: float = 30.0
    record_path: Path | None = None
    preset: str = "theremin"
    window_width: int = 800
    window_height: int = 600
    serve_ws: bool = False
    ws_port: int = 8765
    headless: bool = False
