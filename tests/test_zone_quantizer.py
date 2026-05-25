"""Zone quantizer."""

from src.mapping.scale import ZoneQuantizer


def test_zone_plateau_holds_degree() -> None:
    zq = ZoneQuantizer("pentatonic", zone_ratio=0.55)
    z0 = zq.quantize(0.05)
    for _ in range(5):
        assert zq.quantize(0.06) == z0


def test_zone_changes_at_boundary() -> None:
    zq = ZoneQuantizer("pentatonic", zone_ratio=0.55)
    zq.quantize(0.05)
    for _ in range(3):
        zq.quantize(0.5)
    assert zq.quantize(0.5) != 0
