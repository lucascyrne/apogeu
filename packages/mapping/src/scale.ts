const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

export function buildChromatic(root = "C4", octaves = 1): string[] {
  const m = root.match(/^([A-G][#b]?)(\d+)$/);
  if (!m) return buildChromatic("C4", octaves);
  let name = m[1];
  const startOct = parseInt(m[2], 10);
  if (FLAT_TO_SHARP[name]) name = FLAT_TO_SHARP[name];
  const startI = NOTE_NAMES.indexOf(name) >= 0 ? NOTE_NAMES.indexOf(name) : 0;
  const notes: string[] = [];
  for (let o = 0; o < octaves; o++) {
    for (let i = 0; i < 12; i++) {
      notes.push(`${NOTE_NAMES[(startI + i) % 12]}${startOct + o}`);
    }
  }
  return notes;
}

const SCALES: Record<string, string[]> = {
  pentatonic: ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"],
  major: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
  minor: ["C4", "D4", "Eb4", "F4", "G4", "Ab4", "Bb4", "C5"],
  chromatic: buildChromatic("C4", 1),
  chromatic_2: buildChromatic("C4", 2),
  blues: ["C4", "Eb4", "F4", "Gb4", "G4", "Bb4", "C5"],
  dorian: ["C4", "D4", "Eb4", "F4", "G4", "A4", "Bb4", "C5"],
};

export function getScaleNotes(scaleName: string): string[] {
  return [...(SCALES[scaleName] ?? SCALES.pentatonic)];
}

export function scaleSize(scaleName: string): number {
  return getScaleNotes(scaleName).length;
}

export function noteAtDegree(
  scaleName: string,
  degree: number,
  octaveShift: number
): string {
  const notes = getScaleNotes(scaleName);
  const idx = Math.max(0, Math.min(notes.length - 1, degree));
  const note = notes[idx];
  if (octaveShift === 0) return note;
  return shiftOctave(note, octaveShift * 12);
}

export function noteToMidi(note: string): number {
  const m = note.match(/^([A-G][#b]?)(\d+)$/);
  if (!m) return 60;
  let name = m[1];
  const oct = parseInt(m[2], 10);
  if (FLAT_TO_SHARP[name]) name = FLAT_TO_SHARP[name];
  const i = NOTE_NAMES.indexOf(name);
  if (i < 0) return 60;
  return i + (oct + 1) * 12;
}

export function midiToNoteName(midi: number): string {
  const m = Math.round(Math.max(0, Math.min(127, midi)));
  const name = NOTE_NAMES[m % 12];
  const oct = Math.floor(m / 12) - 1;
  return `${name}${oct}`;
}

/** Glide só entre notas adjacentes da escala (não cromático global). */
export function pitchNormToScaleIndex(norm: number, scaleName: string): number {
  const notes = getScaleNotes(scaleName);
  if (notes.length <= 1) return 0;
  const n = Math.max(0, Math.min(1, norm));
  return n * (notes.length - 1);
}

export function pitchNormToScaleDegree(norm: number, scaleName: string): number {
  const notes = getScaleNotes(scaleName);
  if (notes.length === 0) return 0;
  return Math.round(pitchNormToScaleIndex(norm, scaleName));
}

export function degreeToScaleMidi(
  degree: number,
  scaleName: string,
  octaveShift: number
): number {
  return noteToMidi(noteAtDegree(scaleName, degree, octaveShift));
}

/** Graus discretos com histerese; no máximo ±1 grau por chamada. */
export class ScaleQuantizer {
  private notes: string[];
  private hysteresis: number;
  private lastDegree: number | null = null;

  constructor(scaleName: string, hysteresis = 0.04) {
    this.notes = getScaleNotes(scaleName);
    this.hysteresis = Math.max(0.01, Math.min(0.2, hysteresis));
  }

  get size(): number {
    return this.notes.length;
  }

  reset(): void {
    this.lastDegree = null;
  }

  syncDegree(degree: number): void {
    const n = this.notes.length;
    if (n <= 1) {
      this.lastDegree = 0;
      return;
    }
    this.lastDegree = Math.max(0, Math.min(n - 1, degree));
  }

  /** Schmitt nos meios dos graus: ±1 por chamada, sem oscilar no limiar. */
  quantize(norm: number): number {
    const n = this.notes.length;
    if (n <= 1) return 0;

    const target = Math.max(0, Math.min(1, norm)) * (n - 1);
    if (this.lastDegree == null) {
      this.lastDegree = Math.min(n - 1, Math.max(0, Math.round(target)));
      return this.lastDegree;
    }

    let d = this.lastDegree;
    const margin = this.hysteresis * 0.5;
    if (d < n - 1 && target >= d + 0.5 + margin) {
      d += 1;
    } else if (d > 0 && target <= d - 0.5 - margin) {
      d -= 1;
    }
    this.lastDegree = d;
    return d;
  }
}

export function pitchNormToScaleMidi(
  norm: number,
  scaleName: string,
  octaveShift: number
): number {
  const notes = getScaleNotes(scaleName);
  if (notes.length === 0) return 60;
  if (notes.length === 1) {
    return noteToMidi(notes[0]) + octaveShift * 12;
  }
  const t = pitchNormToScaleIndex(norm, scaleName);
  const i0 = Math.floor(t);
  const i1 = Math.min(i0 + 1, notes.length - 1);
  const frac = t - i0;
  const m0 = noteToMidi(notes[i0]) + octaveShift * 12;
  const m1 = noteToMidi(notes[i1]) + octaveShift * 12;
  return m0 + frac * (m1 - m0);
}

/** @deprecated Use pitchNormToScaleMidi — cromático entre extremos. */
export function pitchNormToMidi(
  norm: number,
  scaleName: string,
  octaveShift: number
): number {
  return pitchNormToScaleMidi(norm, scaleName, octaveShift);
}

function shiftOctave(note: string, semitones: number): string {
  const m = note.match(/^([A-G][#b]?)(\d+)$/);
  if (!m) return note;
  let name = m[1];
  const oct = parseInt(m[2], 10);
  if (FLAT_TO_SHARP[name]) name = FLAT_TO_SHARP[name];
  const i = NOTE_NAMES.indexOf(name);
  if (i < 0) return note;
  const midi = i + (oct + 1) * 12 + semitones;
  const outOct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${outOct}`;
}

export class ZoneQuantizer {
  private notes: string[];
  private zoneRatio: number;
  private degree: number | null = null;
  private published: number | null = null;
  private candidate: number | null = null;
  private candidateCount = 0;
  private readonly holdFrames = 2;

  constructor(scaleName: string, zoneRatio = 0.55) {
    this.notes = getScaleNotes(scaleName);
    this.zoneRatio = Math.max(0.3, Math.min(0.9, zoneRatio));
  }

  get size(): number {
    return this.notes.length;
  }

  noteAt(degree: number, octaveShift = 0): string {
    const idx = Math.max(0, Math.min(this.notes.length - 1, degree));
    const note = this.notes[idx];
    if (octaveShift === 0) return note;
    return shiftOctave(note, octaveShift * 12);
  }

  quantize(norm: number): number {
    const n = this.notes.length;
    if (n <= 1) return 0;

    norm = Math.max(0, Math.min(1, norm));
    if (this.degree == null) {
      this.degree = this.rawZone(norm, n);
      return this.emit(this.degree);
    }

    const lo = this.degree / n;
    const hi = (this.degree + 1) / n;
    const margin = (1 - this.zoneRatio) / (2 * n);
    if (lo + margin <= norm && norm <= hi - margin) {
      return this.emit(this.degree);
    }

    this.degree = this.rawZone(norm, n);
    return this.emit(this.degree);
  }

  private rawZone(norm: number, n: number): number {
    if (norm >= 1) return n - 1;
    return Math.min(n - 1, Math.floor(norm * n));
  }

  private emit(degree: number): number {
    if (this.published == null) {
      this.published = degree;
      this.candidate = degree;
      this.candidateCount = 0;
      return degree;
    }
    if (degree === this.published) {
      this.candidate = degree;
      this.candidateCount = 0;
      return this.published;
    }
    if (degree === this.candidate) {
      this.candidateCount += 1;
    } else {
      this.candidate = degree;
      this.candidateCount = 1;
    }
    if (this.candidateCount >= this.holdFrames) {
      this.published = this.candidate;
      this.candidateCount = 0;
    }
    return this.published;
  }
}
