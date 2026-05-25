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

export function noteAtDegree(
  scaleName: string,
  degree: number,
  octaveShift: number
): string {
  const notes = SCALES[scaleName] ?? SCALES.pentatonic;
  const idx = Math.max(0, Math.min(notes.length - 1, degree));
  const note = notes[idx];
  if (octaveShift === 0) return note;
  return shiftOctave(note, octaveShift * 12);
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

export function scaleSize(scaleName: string): number {
  return (SCALES[scaleName] ?? SCALES.pentatonic).length;
}
