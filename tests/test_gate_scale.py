"""Gate latch."""

from src.mapping.gate_latch import GateLatch


def test_gate_latch_holds_through_intermediate() -> None:
    latch = GateLatch(["Open_Palm"], ["Closed_Fist"], window=8, open_threshold=5)
    for _ in range(4):
        assert latch.update("Open_Palm", True, "Open_Palm") is False
    assert latch.update("Open_Palm", True, "Open_Palm") is True
    for g in ["Pointing_Up", "Victory", "None"] * 3:
        assert latch.update(g, True, "Open_Palm") is True
    for _ in range(4):
        latch.update("x", True, "Closed_Fist")
    assert latch.update("x", True, "Closed_Fist") is False


def test_gate_latch_survives_brief_absence() -> None:
    latch = GateLatch(["Open_Palm"], ["Closed_Fist"], absent_hold=5)
    for _ in range(6):
        latch.update("Open_Palm", True, "Open_Palm")
    for _ in range(4):
        assert latch.update("Open_Palm", False, "Open_Palm") is True
    assert latch.update("Open_Palm", False, "Open_Palm") is False
