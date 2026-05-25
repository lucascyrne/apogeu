"""Testes unitários da camada Expression (sem câmera)."""

from src.expression.features import extract_raw_features
from src.expression.smooth import apply_dead_zone, ema
from src.recognizer import HandState, HandsSnapshot, Landmark


def _hand(x: float, y: float, z: float = 0.0) -> HandState:
    return HandState(
        gesture="Open_Palm",
        score=0.9,
        handedness="Right",
        landmarks=[Landmark(x=x, y=y, z=z)],
        presence=True,
    )


def test_extract_two_hands_distance() -> None:
    snap = HandsSnapshot(
        left=_hand(0.2, 0.5),
        right=_hand(0.8, 0.5),
        timestamp_ms=1,
    )
    raw = extract_raw_features(snap)
    assert raw.left.presence
    assert raw.right.presence
    assert raw.hands_distance > 0.3


def test_ema_smooths() -> None:
    v = 0.0
    for sample in [1.0, 1.0, 1.0]:
        v = ema(v, sample, alpha=0.3)
    assert 0.5 < v < 1.0


def test_dead_zone_center() -> None:
    assert apply_dead_zone(0.51, 0.5, 0.06) == 0.5
