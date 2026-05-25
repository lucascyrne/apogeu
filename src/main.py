"""Entrypoint: MVP legado e modo musical (Fase 2)."""

from __future__ import annotations

import argparse
import sys
import time
from collections import deque
from pathlib import Path

import cv2

from src.camera import AUTO_CAMERA_INDEX, Camera
from src.camera_picker import pick_camera_interactive, probe_to_backend_flag
from src.camera_probe import list_usable_cameras
from src.config import AppConfig, DEFAULT_MODEL_PATH, PROJECT_ROOT
from src.events import ControlChangeEvent, EventEmitter, emit, emit_stderr
from src.expression.engine import ExpressionEngine
from src.mapping.loader import load_instrument_config
from src.mapping.mapper import GestureMapper
from src.overlay import render_frame
from src.recognizer import GestureRecognizerWrapper
from src.stabilizer import GestureStabilizer


def _parse_camera(value: str) -> int:
    if value.strip().lower() == "auto":
        return AUTO_CAMERA_INDEX
    return int(value)


def parse_args() -> AppConfig:
    parser = argparse.ArgumentParser(
        description="Reconhecimento de gestos e instrumento gestual via webcam."
    )
    parser.add_argument("--list-cameras", action="store_true")
    parser.add_argument("--camera", type=_parse_camera, default="auto")
    parser.add_argument("--no-fallback-scan", action="store_true")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--vote-window", type=int, default=8)
    parser.add_argument("--min-consecutive", type=int, default=5)
    parser.add_argument("--cooldown-ms", type=int, default=300)
    parser.add_argument("--score-threshold", type=float, default=0.6)
    parser.add_argument("--with-landmarks", action="store_true")
    parser.add_argument("--camera-backend", choices=("auto", "dshow", "msmf", "any"), default="auto")
    parser.add_argument("-p", "--pick-camera", action="store_true")
    parser.add_argument("--no-pick-camera", action="store_true")
    parser.add_argument("--musical", action="store_true", help="Modo instrumento: 2 maos + control.frame")
    parser.add_argument("--emit-rate", type=float, default=30.0, help="Hz para control.frame")
    parser.add_argument("--instrument", type=Path, help="YAML de mapeamento musical")
    parser.add_argument("--record", type=Path, help="Gravar NDJSON em arquivo")
    parser.add_argument("--serve", action="store_true", help="WebSocket ao vivo (modo musical)")
    parser.add_argument("--port", type=int, default=8765, help="Porta WebSocket")
    parser.add_argument("--window-width", type=int, default=800, help="Largura inicial da janela")
    parser.add_argument("--window-height", type=int, default=600, help="Altura inicial da janela")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Sem janela OpenCV (dev/CI; ainda usa camera local)",
    )
    args = parser.parse_args()

    if args.list_cameras:
        from src.list_cameras import main as list_cameras_main

        list_cameras_main()
        raise SystemExit(0)

    instrument = args.instrument
    if instrument is None and args.musical:
        from src.config import DEFAULT_INSTRUMENT_PATH

        instrument = DEFAULT_INSTRUMENT_PATH

    vote_window = args.vote_window
    min_consecutive = args.min_consecutive
    if args.musical:
        if vote_window == 8:
            vote_window = 12
        if min_consecutive == 5:
            min_consecutive = 6

    return AppConfig(
        model_path=args.model,
        camera_index=args.camera,
        frame_width=args.width,
        frame_height=args.height,
        vote_window=vote_window,
        min_consecutive=min_consecutive,
        cooldown_ms=args.cooldown_ms,
        score_threshold=args.score_threshold,
        with_landmarks=args.with_landmarks or args.musical,
        camera_backend=args.camera_backend,
        fallback_scan=not args.no_fallback_scan,
        pick_camera=args.pick_camera,
        no_pick_camera=args.no_pick_camera,
        musical=args.musical,
        num_hands=2 if args.musical else 1,
        emit_rate_hz=args.emit_rate,
        record_path=args.record,
        instrument_config=instrument or AppConfig.instrument_config,
        window_width=args.window_width,
        window_height=args.window_height,
        serve_ws=args.musical,
        ws_port=args.port,
        headless=args.headless,
    )


def _should_open_picker(config: AppConfig) -> bool:
    if config.pick_camera:
        return True
    if config.no_pick_camera:
        return False
    if config.camera_index != AUTO_CAMERA_INDEX:
        return False
    return len(list_usable_cameras()) > 1


def _resolve_camera(config: AppConfig) -> tuple[Camera, int]:
    probe = None
    if _should_open_picker(config):
        if not config.pick_camera:
            emit_stderr("Varias cameras — abrindo seletor.")
        probe = pick_camera_interactive()
        if probe is None:
            emit_stderr("Selecao cancelada.")
            return Camera(config), 1
    if probe is not None:
        config.camera_index = probe.index
        config.camera_backend = probe_to_backend_flag(probe)
        return Camera(config, probe=probe), 0
    return Camera(config), 0


def _setup_window(config: AppConfig) -> None:
    cv2.namedWindow(config.window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(config.window_name, config.window_width, config.window_height)


def _emit_gesture_events(emitter: EventEmitter | None, events: object) -> None:
    if events is None:
        return
    if isinstance(events, list):
        for ev in events:
            if emitter:
                emitter.emit(ev)
            else:
                emit(ev)
    else:
        if emitter:
            emitter.emit(events)
        else:
            emit(events)


def run_loop(config: AppConfig) -> int:
    camera, picker_status = _resolve_camera(config)
    if picker_status != 0:
        return 1

    stabilizer = GestureStabilizer(config)
    fps_samples: deque[float] = deque(maxlen=30)
    last_fps_time = time.monotonic()

    instrument_cfg = load_instrument_config(config.instrument_config) if config.musical else None
    expression = (
        ExpressionEngine(
            dead_zone=instrument_cfg.dead_zone,
            alpha=instrument_cfg.smoothing_alpha,
        )
        if instrument_cfg
        else None
    )
    mapper = GestureMapper(instrument_cfg) if instrument_cfg else None
    ws_broadcast = None
    if config.musical and config.serve_ws:
        from src.ws_hub import broadcast, start_ws_server

        start_ws_server(config.ws_port)
        ws_broadcast = broadcast
        emit_stderr(f"WebSocket: ws://localhost:{config.ws_port}")

    emitter = (
        EventEmitter(
            emit_rate_hz=config.emit_rate_hz,
            record_path=config.record_path,
            broadcast=ws_broadcast,
        )
        if config.musical
        else None
    )
    last_control = None

    try:
        camera.open()
    except RuntimeError as exc:
        emit_stderr(str(exc))
        return 1

    consecutive_failures = 0
    title = "Hand Gestures Musical" if config.musical else config.window_name
    config.window_name = title
    if not config.headless:
        _setup_window(config)

    try:
        with GestureRecognizerWrapper(config) as recognizer:
            mode = "musical (2 maos)" if config.musical else "MVP"
            emit_stderr(f"Hand Gestures — modo {mode}. Pressione 'q' para sair.")
            emit_stderr(f"Camera: indice {camera.resolved_index}, backend {camera.backend_label}")
            if config.record_path:
                emit_stderr(f"Gravando eventos em: {config.record_path}")

            while True:
                success, frame, timestamp_ms = camera.read()
                if not success:
                    consecutive_failures += 1
                    if consecutive_failures >= config.max_read_failures:
                        emit_stderr("Falha ao ler frame da camera.")
                        break
                    continue
                consecutive_failures = 0

                recognizer.submit(frame, timestamp_ms)
                snapshot = recognizer.latest_snapshot()

                gesture_out = stabilizer.update(snapshot, timestamp_ms)
                _emit_gesture_events(emitter, gesture_out)

                control = None
                if config.musical and expression and mapper and snapshot:
                    smoothed = expression.process(snapshot)
                    control = mapper.map_frame(
                        smoothed,
                        timestamp_ms,
                        stabilizer.left_gesture,
                        stabilizer.right_gesture,
                        stabilizer.right_gesture_stable,
                    )
                    if emitter and emitter.emit_control_if_due(control, timestamp_ms):
                        last_control = control

                    if gesture_out and isinstance(gesture_out, list):
                        for gev in gesture_out:
                            action = mapper.gesture_action(gev.gesture, gev.hand)
                            if not action:
                                continue
                            act = str(action.get("action", ""))
                            if act == "octave_up":
                                mapper.apply_octave_shift(1)
                            elif act == "octave_down":
                                mapper.apply_octave_shift(-1)
                            if emitter:
                                emitter.emit(
                                    ControlChangeEvent(
                                        timestamp_ms=timestamp_ms,
                                        change=act or "gesture",
                                        value=gev.gesture,
                                    )
                                )

                now = time.monotonic()
                dt = now - last_fps_time
                last_fps_time = now
                if dt > 0:
                    fps_samples.append(1.0 / dt)
                fps = sum(fps_samples) / len(fps_samples) if fps_samples else 0.0

                if not config.headless:
                    display = render_frame(
                        frame,
                        snapshot,
                        stabilizer.current_gesture,
                        stabilizer.current_score,
                        stabilizer.current_handedness,
                        fps,
                        musical=config.musical,
                        control=last_control,
                    )
                    cv2.imshow(config.window_name, display)

                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                    if cv2.getWindowProperty(config.window_name, cv2.WND_PROP_VISIBLE) < 1:
                        break

    except KeyboardInterrupt:
        emit_stderr("Interrompido.")
    finally:
        if emitter:
            emitter.close()
        camera.release()
        if not config.headless:
            cv2.destroyAllWindows()

    return 0


def main() -> None:
    sys.exit(run_loop(parse_args()))


if __name__ == "__main__":
    main()
