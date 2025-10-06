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

export const MIDI_TRANSPORT_CC = {
    STOP: 117,
    PLAY: 118,
    RECORD: 119,
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