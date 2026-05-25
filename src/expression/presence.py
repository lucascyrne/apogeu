"""Hold de presence para evitar flicker ao cruzar mãos."""


class PresenceHold:
    def __init__(self, hold_frames: int = 8) -> None:
        self._hold = hold_frames
        self._missing = 0
        self._seen = False

    def update(self, present: bool) -> bool:
        if present:
            self._missing = 0
            self._seen = True
            return True
        self._missing += 1
        if self._seen and self._missing < self._hold:
            return True
        self._seen = False
        return False
