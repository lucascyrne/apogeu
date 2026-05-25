"""Exporta fixtures NDJSON para testes de paridade do mapper TS."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.expression.engine import ExpressionEngine
from src.mapping.loader import load_instrument_config
from src.mapping.mapper import GestureMapper
from src.recognizer import HandState, HandsSnapshot, Landmark


def _lm(x: float, y: float) -> list[Landmark]:
    return [Landmark(x=x, y=y, z=0.0) for _ in range(21)]


def main() -> None:
    out = ROOT / "apps" / "instrument" / "public" / "fixtures"
    out.mkdir(parents=True, exist_ok=True)

    cfg = load_instrument_config()
    expr = ExpressionEngine(cfg.dead_zone, cfg.smoothing_alpha)
    mapper = GestureMapper(cfg)

    snapshot = HandsSnapshot(
        left=HandState("None", 0.9, "Left", _lm(0.25, 0.4), True),
        right=HandState("Open_Palm", 0.92, "Right", _lm(0.75, 0.55), True),
        timestamp_ms=1000,
    )
    smoothed = expr.process(snapshot)
    frame = mapper.map_frame(
        smoothed, 1000, "None", "Open_Palm", "Open_Palm"
    )

    path = out / "parity_gate_open.json"
    path.write_text(
        json.dumps(json.loads(frame.model_dump_json()), indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
