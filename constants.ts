import { KnobState, Preset, PadState, SynthEngine } from './types';

// Standard CC mapping for Akai MPK Mini Plus
export const MIDI_KNOB_CC_MAP: { [key: number]: number } = {
  70: 1, // Knob 1
  71: 2, // Knob 2
  72: 3, // Knob 3
  73: 4, // Knob 4
  74: 5, // Knob 5 (Filter Cutoff)
  75: 6, // Knob 6
  76: 7, // Knob 7
  77: 8, // Knob 8
};

// Additional standard CCs for direct parameter control
export const MIDI_DIRECT_PARAM_CC_MAP: { [key: number]: string } = {
    78: 'glide',
    79: 'filterResonance',
    80: 'attack',
    81: 'decay',
    82: 'sustain',
    83: 'release',
    91: 'fxDepth', // Often Reverb Depth
    93: 'mixFx'     // Often Chorus Depth
};

export const MIDI_TRANSPORT_CC = {
    STOP: 117,
    PLAY: 118,
    RECORD: 119,
};

// MIDI note numbers for the first 8 pads on many controllers (e.g., Akai MPK Mini starts at 36)
export const MIDI_PAD_NOTE_MAP: { [key: number]: number } = {
    36: 1, // Pad 1 (Top-left) -> Chord 1
    37: 2, // Pad 2 -> Chord 2
    38: 3, // Pad 3 -> Chord 3
    39: 4, // Pad 4 -> Chord 4
    40: 5, // Pad 5 (Bottom-left) -> Arp Up
    41: 6, // Pad 6 -> Arp Down
    42: 7, // Pad 7 -> Arp Random
    43: 8, // Pad 8 -> Arp Evolve
};

export const INITIAL_KNOBS: KnobState[] = [
  { id: 1, label: 'Chord Complexity', value: 30, cc: 70 },
  { id: 2, label: 'Arp Density', value: 50, cc: 71 },
  { id: 3, label: 'Swing', value: 0, cc: 72 },
  { id: 4, label: 'FX Depth', value: 40, cc: 73 },
  { id: 5, label: 'Filter Cutoff', value: 80, cc: 74 },
  { id: 6, label: 'Filter Res', value: 20, cc: 75 },
  { id: 7, label: 'Timbre Morph', value: 0, cc: 76 },
  { id: 8, label: 'Mix FX', value: 10, cc: 77 },
  { id: 9, label: 'Glide', value: 0, cc: 78 },
  // ADSR Envelope
  { id: 10, label: 'Attack', value: 5, cc: 80 },
  { id: 11, label: 'Decay', value: 20, cc: 81 },
  { id: 12, label: 'Sustain', value: 70, cc: 82 },
  { id: 13, label: 'Release', value: 30, cc: 83 },
];

export const PRESETS: Preset[] = [
  {
    name: 'Neon Sunset',
    engine: 'Analog',
    key: 'C',
    scale: 'Minor',
    knobs: [
        { id: 1, label: 'Chord Complexity', value: 45, cc: 70 },
        { id: 2, label: 'Arp Density', value: 60, cc: 71 },
        { id: 3, label: 'Swing', value: 10, cc: 72 },
        { id: 4, label: 'FX Depth', value: 70, cc: 73 },
        { id: 5, label: 'Filter Cutoff', value: 75, cc: 74 },
        { id: 6, label: 'Filter Res', value: 30, cc: 75 },
        { id: 7, label: 'Timbre Morph', value: 20, cc: 76 },
        { id: 8, label: 'Mix FX', value: 50, cc: 77 },
        { id: 9, label: 'Glide', value: 5, cc: 78 },
        // Pad ADSR
        { id: 10, label: 'Attack', value: 60, cc: 80 },
        { id: 11, label: 'Decay', value: 30, cc: 81 },
        { id: 12, label: 'Sustain', value: 100, cc: 82 },
        { id: 13, label: 'Release', value: 70, cc: 83 },
    ],
  },
  {
    name: 'Night Drive Arp',
    engine: 'FM',
    key: 'G',
    scale: 'Dorian',
    knobs: [
        { id: 1, label: 'Chord Complexity', value: 20, cc: 70 },
        { id: 2, label: 'Arp Density', value: 85, cc: 71 },
        { id: 3, label: 'Swing', value: 0, cc: 72 },
        { id: 4, label: 'FX Depth', value: 50, cc: 73 },
        { id: 5, label: 'Filter Cutoff', value: 90, cc: 74 },
        { id: 6, label: 'Filter Res', value: 10, cc: 75 },
        { id: 7, label: 'Timbre Morph', value: 80, cc: 76 },
        { id: 8, label: 'Mix FX', value: 25, cc: 77 },
        { id: 9, label: 'Glide', value: 10, cc: 78 },
        // Plucky ADSR
        { id: 10, label: 'Attack', value: 2, cc: 80 },
        { id: 11, label: 'Decay', value: 40, cc: 81 },
        { id: 12, label: 'Sustain', value: 0, cc: 82 },
        { id: 13, label: 'Release', value: 20, cc: 83 },
    ],
  },
   {
    name: 'Retro Padscape',
    engine: 'Reed Piano',
    key: 'A#',
    scale: 'Major',
    knobs: [
        { id: 1, label: 'Chord Complexity', value: 80, cc: 70 },
        { id: 2, label: 'Arp Density', value: 20, cc: 71 },
        { id: 3, label: 'Swing', value: 25, cc: 72 },
        { id: 4, 'label': 'FX Depth', value: 90, cc: 73 },
        { id: 5, label: 'Filter Cutoff', value: 40, cc: 74 },
        { id: 6, label: 'Filter Res', value: 60, cc: 75 },
        { id: 7, label: 'Timbre Morph', value: 10, cc: 76 },
        { id: 8, label: 'Mix FX', value: 70, cc: 77 },
        { id: 9, label: 'Glide', value: 0, cc: 78 },
        // Electric Piano ADSR
        { id: 10, label: 'Attack', value: 5, cc: 80 },
        { id: 11, label: 'Decay', value: 60, cc: 81 },
        { id: 12, label: 'Sustain', value: 50, cc: 82 },
        { id: 13, label: 'Release', value: 45, cc: 83 },
    ],
  },
  {
    name: 'Zen Garden',
    engine: 'Hang Drum',
    key: 'C',
    scale: 'Minor',
    knobs: [
        { id: 1, label: 'Chord Complexity', value: 90, cc: 70 },
        { id: 2, label: 'Arp Density', value: 25, cc: 71 },
        { id: 3, label: 'Swing', value: 5, cc: 72 },
        { id: 4, label: 'FX Depth', value: 60, cc: 73 },
        { id: 5, label: 'Filter Cutoff', value: 100, cc: 74 },
        { id: 6, label: 'Filter Res', value: 0, cc: 75 },
        { id: 7, label: 'Timbre Morph', value: 50, cc: 76 },
        { id: 8, label: 'Mix FX', value: 60, cc: 77 },
        { id: 9, label: 'Glide', value: 2, cc: 78 },
        // Percussive ADSR
        { id: 10, label: 'Attack', value: 1, cc: 80 },
        { id: 11, label: 'Decay', value: 80, cc: 81 },
        { id: 12, label: 'Sustain', value: 0, cc: 82 },
        { id: 13, label: 'Release', value: 70, cc: 83 },
    ],
  },
  {
    name: 'Vintage Strings',
    engine: 'String Machine',
    key: 'D',
    scale: 'Minor',
    knobs: [
        { id: 1, label: 'Chord Complexity', value: 85, cc: 70 },
        { id: 2, label: 'Arp Density', value: 30, cc: 71 },
        { id: 3, label: 'Swing', value: 0, cc: 72 },
        { id: 4, label: 'FX Depth', value: 65, cc: 73 },
        { id: 5, label: 'Filter Cutoff', value: 60, cc: 74 },
        { id: 6, label: 'Filter Res', value: 25, cc: 75 },
        { id: 7, label: 'Timbre Morph', value: 40, cc: 76 },
        { id: 8, label: 'Mix FX', value: 70, cc: 77 },
        { id: 9, label: 'Glide', value: 15, cc: 78 },
        // String ADSR
        { id: 10, label: 'Attack', value: 75, cc: 80 },
        { id: 11, label: 'Decay', value: 0, cc: 81 },
        { id: 12, label: 'Sustain', value: 100, cc: 82 },
        { id: 13, label: 'Release', value: 65, cc: 83 },
    ],
  },
];

export const PADS: PadState[] = [
    { id: 1, label: 'Major', type: 'chord', value: 'maj' },
    { id: 2, label: 'Minor', type: 'chord', value: 'min' },
    { id: 3, label: 'Sus4', type: 'chord', value: 'sus4' },
    { id: 4, label: 'Dim', type: 'chord', value: 'dim' },
    { id: 5, label: 'Arp Up', type: 'arp', value: 'up' },
    { id: 6, label: 'Arp Down', type: 'arp', value: 'down' },
    { id: 7, label: 'Arp Random', type: 'arp', value: 'random' },
    { id: 8, label: 'Arp Evolve', type: 'arp', value: 'evolving' },
];

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = ['Major', 'Minor', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Locrian'];
export const ENGINES: SynthEngine[] = ['Analog', 'FM', 'Reed Piano', 'Hang Drum', 'String Machine'];