"""DistanceCalibrator — mapeamento 0–1."""

import pytest

from src.expression.distance import DistanceCalibrator


def test_yaml_bounds_when_no_auto() -> None:
    cal = DistanceCalibrator(dist_min=0.1, dist_max=0.5)
    assert cal.map(0.1, False, 0) == 0.0
    assert cal.map(0.5, False, 0) == 1.0
    assert cal.map(0.3, False, 0) == pytest.approx(0.5)


def test_auto_overrides_yaml_after_calibration() -> None:
    cal = DistanceCalibrator(dist_min=0.0, dist_max=1.0)
    t = 0
    for _ in range(25):
        cal.map(0.14, True, t)
        t += 33
    for _ in range(25):
        cal.map(0.38, True, t)
        t += 33
    assert cal.map(0.14, False, t) == 0.0
    assert cal.map(0.38, False, t) == 1.0
    assert cal.map(0.26, False, t) == pytest.approx(0.5, abs=0.08)


def test_auto_calibration_reaches_extremes() -> None:
    cal = DistanceCalibrator()
    t = 0
    for _ in range(30):
        cal.map(0.12, True, t)
        t += 33
    for _ in range(30):
        cal.map(0.45, True, t)
        t += 33
    assert cal.map(0.12, False, t) == 0.0
    assert cal.map(0.45, False, t) == 1.0


def test_idle_resets_auto_range() -> None:
    cal = DistanceCalibrator()
    cal.map(0.2, True, 0)
    cal.map(0.4, True, 500)
    assert cal.map(0.2, False, 2500) < 0.5
