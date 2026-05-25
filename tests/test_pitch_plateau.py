"""Platô de pitch fora da ROI e quantização discreta."""

from src.expression.viewport import ROI_MARGIN, pitch_norm_from_camera_point
from src.mapping.scale import ScaleQuantizer, degree_to_scale_midi


def test_pitch_plateau_above_roi() -> None:
    assert pitch_norm_from_camera_point(0.5, ROI_MARGIN - 0.05, "y") == 1.0


def test_pitch_plateau_below_roi() -> None:
    hi = 1.0 - ROI_MARGIN
    assert pitch_norm_from_camera_point(0.5, hi + 0.05, "y") == 0.0


def test_scale_quantizer_step_one() -> None:
    q = ScaleQuantizer("pentatonic", hysteresis=0.04)
    prev = q.quantize(0.0)
    for i in range(1, 51):
        d = q.quantize(i / 50.0)
        assert abs(d - prev) <= 1
        prev = d


def test_degree_to_scale_midi_integer() -> None:
    a = degree_to_scale_midi(0, "pentatonic", 0)
    b = degree_to_scale_midi(1, "pentatonic", 0)
    assert a == int(a)
    assert b == int(b)
    assert b > a
