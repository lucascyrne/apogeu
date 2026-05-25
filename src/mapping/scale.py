"""Escalas e quantização por zonas."""

from __future__ import annotations

import math
import re

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_FLAT_TO_SHARP = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}


def build_chromatic(root: str = "C4", octaves: int = 1) -> list[str]:
    m = re.match(r"^([A-G][#b]?)(\d+)$", root)
    if not m:
        return build_chromatic("C4", octaves)
    name, start_oct = m.group(1), int(m.group(2))
    if name in _FLAT_TO_SHARP:
        name = _FLAT_TO_SHARP[name]
    if name not in _NOTE_NAMES:
        name = "C"
    start_i = _NOTE_NAMES.index(name)
    notes: list[str] = []
    for o in range(octaves):
        for i in range(12):
            notes.append(f"{_NOTE_NAMES[(start_i + i) % 12]}{start_oct + o}")
    return notes


SCALES: dict[str, list[str]] = {
    "pentatonic": ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"],
    "major": ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    "minor": ["C4", "D4", "Eb4", "F4", "G4", "Ab4", "Bb4", "C5"],
    "chromatic": build_chromatic("C4", 1),
    "chromatic_2": build_chromatic("C4", 2),
    "blues": ["C4", "Eb4", "F4", "Gb4", "G4", "Bb4", "C5"],
    "dorian": ["C4", "D4", "Eb4", "F4", "G4", "A4", "Bb4", "C5"],
}


def get_scale_notes(scale_name: str) -> list[str]:
    return list(SCALES.get(scale_name, SCALES["pentatonic"]))


def scale_size(scale_name: str) -> int:
    return len(get_scale_notes(scale_name))


def _note_to_midi(note: str) -> int:
    m = re.match(r"^([A-G][#b]?)(\d+)$", note)
    if not m:
        return 60
    name, oct_s = m.group(1), int(m.group(2))
    if name in _FLAT_TO_SHARP:
        name = _FLAT_TO_SHARP[name]
    if name not in _NOTE_NAMES:
        return 60
    return _NOTE_NAMES.index(name) + (oct_s + 1) * 12


def pitch_norm_to_scale_index(norm: float, scale_name: str) -> float:
    notes = get_scale_notes(scale_name)
    if len(notes) <= 1:
        return 0.0
    n = max(0.0, min(1.0, norm))
    return n * (len(notes) - 1)


def pitch_norm_to_scale_degree(norm: float, scale_name: str) -> int:
    notes = get_scale_notes(scale_name)
    if not notes:
        return 0
    return int(round(pitch_norm_to_scale_index(norm, scale_name)))


def pitch_norm_to_scale_midi(
    norm: float, scale_name: str, octave_shift: int = 0
) -> float:
    notes = get_scale_notes(scale_name)
    if not notes:
        return 60.0
    if len(notes) == 1:
        return float(_note_to_midi(notes[0]) + octave_shift * 12)
    t = pitch_norm_to_scale_index(norm, scale_name)
    i0 = int(math.floor(t))
    i1 = min(i0 + 1, len(notes) - 1)
    frac = t - i0
    m0 = _note_to_midi(notes[i0]) + octave_shift * 12
    m1 = _note_to_midi(notes[i1]) + octave_shift * 12
    return m0 + frac * (m1 - m0)


def pitch_norm_to_midi(norm: float, scale_name: str, octave_shift: int = 0) -> float:
    return pitch_norm_to_scale_midi(norm, scale_name, octave_shift)


def note_at_degree(scale_name: str, degree: int, octave_shift: int = 0) -> str:
    notes = get_scale_notes(scale_name)
    idx = max(0, min(len(notes) - 1, degree))
    note = notes[idx]
    if octave_shift == 0:
        return note
    return _shift_octave(note, octave_shift * 12)


def degree_to_scale_midi(
    degree: int, scale_name: str, octave_shift: int = 0
) -> float:
    return float(_note_to_midi(note_at_degree(scale_name, degree, octave_shift)))


class ScaleQuantizer:
    def __init__(
        self,
        scale_name: str = "pentatonic",
        hysteresis: float = 0.04,
    ) -> None:
        self._notes = get_scale_notes(scale_name)
        self._hysteresis = hysteresis
        self._last_degree: int | None = None

    @property
    def size(self) -> int:
        return len(self._notes)

    def reset(self) -> None:
        self._last_degree = None

    def sync_degree(self, degree: int) -> None:
        n = len(self._notes)
        if n <= 1:
            self._last_degree = 0
            return
        self._last_degree = max(0, min(n - 1, degree))

    def note_at(self, degree: int, octave_shift: int = 0) -> str:
        idx = max(0, min(len(self._notes) - 1, degree))
        note = self._notes[idx]
        if octave_shift == 0:
            return note
        return _shift_octave(note, octave_shift * 12)

    def quantize(self, norm: float) -> int:
        n = len(self._notes)
        if n <= 1:
            return 0
        target = max(0.0, min(1.0, norm)) * (n - 1)
        if self._last_degree is None:
            self._last_degree = max(0, min(n - 1, int(round(target))))
            return self._last_degree

        d = self._last_degree
        margin = self._hysteresis * 0.5
        if d < n - 1 and target >= d + 0.5 + margin:
            d += 1
        elif d > 0 and target <= d - 0.5 - margin:
            d -= 1
        self._last_degree = d
        return d


class ZoneQuantizer:
    """Faixas iguais em Y com platô central — troca só ao sair da zona."""

    def __init__(self, scale_name: str = "pentatonic", zone_ratio: float = 0.55) -> None:
        self._notes = get_scale_notes(scale_name)
        self._zone_ratio = max(0.3, min(0.9, zone_ratio))
        self._degree: int | None = None
        self._published: int | None = None
        self._candidate: int | None = None
        self._candidate_count = 0
        self._hold_frames = 2

    @property
    def size(self) -> int:
        return len(self._notes)

    def note_at(self, degree: int, octave_shift: int = 0) -> str:
        idx = max(0, min(len(self._notes) - 1, degree))
        note = self._notes[idx]
        if octave_shift == 0:
            return note
        return _shift_octave(note, octave_shift * 12)

    def _raw_zone(self, norm: float) -> int:
        n = len(self._notes)
        if n <= 1:
            return 0
        norm = max(0.0, min(1.0, norm))
        if norm >= 1.0:
            return n - 1
        return min(n - 1, int(norm * n))

    def quantize(self, norm: float) -> int:
        n = len(self._notes)
        if n <= 1:
            return 0

        norm = max(0.0, min(1.0, norm))
        if self._degree is None:
            self._degree = self._raw_zone(norm)
            return self._emit(self._degree)

        lo = self._degree / n
        hi = (self._degree + 1) / n
        margin = (1.0 - self._zone_ratio) / (2.0 * n)
        if lo + margin <= norm <= hi - margin:
            return self._emit(self._degree)

        self._degree = self._raw_zone(norm)
        return self._emit(self._degree)

    def _emit(self, degree: int) -> int:
        if self._published is None:
            self._published = degree
            self._candidate = degree
            self._candidate_count = 0
            return degree
        if degree == self._published:
            self._candidate = degree
            self._candidate_count = 0
            return self._published
        if degree == self._candidate:
            self._candidate_count += 1
        else:
            self._candidate = degree
            self._candidate_count = 1
        if self._candidate_count >= self._hold_frames:
            self._published = self._candidate
            self._candidate_count = 0
        return self._published


def _shift_octave(note: str, semitones: int) -> str:
    if semitones == 0:
        return note
    m = re.match(r"^([A-G][#b]?)(\d+)$", note)
    if not m:
        return note
    name, oct_s = m.group(1), int(m.group(2))
    if name in _FLAT_TO_SHARP:
        name = _FLAT_TO_SHARP[name]
    if name not in _NOTE_NAMES:
        return note
    midi = _NOTE_NAMES.index(name) + (oct_s + 1) * 12 + semitones
    oct_out = midi // 12 - 1
    return f"{_NOTE_NAMES[midi % 12]}{oct_out}"
