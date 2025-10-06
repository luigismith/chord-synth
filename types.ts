// FIX: Removed self-import of KnobState. A file cannot import a type from itself.

export interface KnobState {
  id: number;
  label: string;
  value: number;
  cc: number;
}

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type SynthEngine = 'Analog' | 'FM' | 'Reed Piano' | 'Hang Drum' | 'String Machine';

export interface Preset {
  name: string;
  knobs: KnobState[];
  engine: SynthEngine;
  key: string;
  scale: string;
}

export interface PadState {
    id: number;
    label: string;
    type: 'chord' | 'arp';
    value: string; // e.g., 'maj', 'min', 'up', 'down'
}

export interface Chord {
    name: string;
    notes: string[];
}