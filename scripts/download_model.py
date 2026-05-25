"""Baixa o modelo gesture_recognizer.task do repositório oficial MediaPipe."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "gesture_recognizer/gesture_recognizer/float16/latest/"
    "gesture_recognizer.task"
)
MODEL_NAME = "gesture_recognizer.task"


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    models_dir = root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    dest = models_dir / MODEL_NAME

    if dest.exists():
        print(f"Modelo já existe: {dest}")
        return 0

    print(f"Baixando {MODEL_URL} ...")
    try:
        urllib.request.urlretrieve(MODEL_URL, dest)
    except OSError as exc:
        print(f"Erro ao baixar modelo: {exc}", file=sys.stderr)
        return 1

    print(f"Modelo salvo em: {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
