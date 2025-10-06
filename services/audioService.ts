import { OscillatorType, SynthEngine } from '../types';

interface ActiveVoice {
  stop: () => void;
  setTimbre: (value: number) => void;
}

const NOTE_VALUES: { [key: string]: number } = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const CHORD_INTERVALS: { [key: string]: number[] } = {
  'maj': [0, 4, 7],
  'min': [0, 3, 7],
  'm': [0, 3, 7], // Alias for minor
  'dim': [0, 3, 6],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'dim7': [0, 3, 6, 9],
  'm7b5': [0, 3, 6, 10], // Half-diminished
};


class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private feedback: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeVoices: Map<number, ActiveVoice> = new Map();
  private currentEngine: SynthEngine = 'Analog';

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(20000, this.audioContext.currentTime);
        this.filter.Q.setValueAtTime(1, this.audioContext.currentTime);

        this.delay = this.audioContext.createDelay(1.0);
        this.feedback = this.audioContext.createGain();
        this.feedback.gain.setValueAtTime(0.0, this.audioContext.currentTime);
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        // Chain: masterGain -> filter -> (analyser -> destination) & (delay chain)
        this.masterGain.connect(this.filter);
        
        this.filter.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        // Send filter output to delay chain in parallel
        this.filter.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        this.delay.connect(this.audioContext.destination);


      } catch (e) {
        console.error("Web Audio API is not supported in this browser");
      }
    }
  }

  public getAnalyser(): AnalyserNode | null {
    if (!this.analyser) {
        this.init();
    }
    return this.analyser;
  }

  public setEngine(engine: SynthEngine) {
    this.currentEngine = engine;
  }

  public getAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      this.init();
    }
    return this.audioContext;
  }

  public midiToFrequency(midiNote: number): number {
    return Math.pow(2, (midiNote - 69) / 12) * 440;
  }

  public playChord(chordNameOrValue: string, key: string, scale: string, timbreValue: number): number[] {
    if (!this.audioContext) return [];

    let rootNoteName: string;
    let quality: string;

    // Try to parse as a full chord name first (e.g., "Am7")
    const match = chordNameOrValue.match(/^([A-G][#b]?)(.*)$/);

    if (match) {
        rootNoteName = match[1];
        // Handle no quality (e.g., "C") as major
        quality = match[2] || 'maj';
    } else {
        // Assume it's a pad value like "maj", "min"
        rootNoteName = key;
        quality = chordNameOrValue;
    }
    
    // Normalize quality name
    quality = quality.toLowerCase().trim();
    if (quality === '') quality = 'maj';

    let intervals = CHORD_INTERVALS[quality];
    if (!intervals) {
        console.warn(`Unknown chord quality: "${quality}". Defaulting to major triad.`);
        intervals = CHORD_INTERVALS['maj'];
    }

    const rootMidiValue = NOTE_VALUES[rootNoteName];
    if (rootMidiValue === undefined) {
        console.error(`Unknown root note: ${rootNoteName}`);
        return [];
    }

    // Determine a good base octave (e.g., octave 3 or 4). Let's use 4 as the base.
    const baseMidiNote = 48 + rootMidiValue;

    const chordNotes = intervals.map(interval => baseMidiNote + interval);

    // Simple voicing logic: ensure notes ascend from the root
    for (let i = 1; i < chordNotes.length; i++) {
        while (chordNotes[i] < chordNotes[i - 1]) {
            chordNotes[i] += 12;
        }
    }

    // Another voicing pass: bring the whole chord closer to a central register if it's too high/low
    const averageNote = chordNotes.reduce((sum, note) => sum + note, 0) / chordNotes.length;
    const targetNote = 60; // Middle C
    const octaveShift = Math.round((targetNote - averageNote) / 12) * 12;
    const finalNotes = chordNotes.map(note => note + octaveShift);

    finalNotes.forEach(note => this.playNote(note, timbreValue));
    
    return finalNotes;
  }

  public playNote(midiNote: number, timbreValue: number) {
    if (!this.audioContext || !this.masterGain) return;
    if (this.activeVoices.has(midiNote)) return;

    this.audioContext.resume();

    let voice: ActiveVoice;
    switch (this.currentEngine) {
      case 'FM':
        voice = this.createFMVoice(midiNote, timbreValue);
        break;
      case 'Reed Piano':
        voice = this.createPianoVoice(midiNote, timbreValue);
        break;
      case 'Hang Drum':
        voice = this.createHangDrumVoice(midiNote, timbreValue);
        break;
      case 'String Machine':
        voice = this.createStringMachineVoice(midiNote, timbreValue);
        break;
      case 'Analog':
      default:
        voice = this.createAnalogVoice(midiNote, timbreValue);
        break;
    }
    this.activeVoices.set(midiNote, voice);
  }

  private createAnalogVoice(midiNote: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    
    const setTimbre = (value: number) => {
        let type: OscillatorType = 'sine';
        if (value > 75) type = 'sawtooth';
        else if (value > 50) type = 'square';
        else if (value > 25) type = 'triangle';
        oscillator.type = type;
    };
    
    setTimbre(timbreValue);
    oscillator.frequency.setValueAtTime(this.midiToFrequency(midiNote), audioContext.currentTime);
    
    noteGain.gain.setValueAtTime(0, audioContext.currentTime);
    noteGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.02);

    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start();

    const stop = () => {
      const now = audioContext.currentTime;
      noteGain.gain.cancelScheduledValues(now);
      noteGain.gain.setValueAtTime(noteGain.gain.value, now);
      noteGain.gain.linearRampToValueAtTime(0, now + 0.2);
      oscillator.stop(now + 0.2);
    };

    return { stop, setTimbre };
  }
  
  private createFMVoice(midiNote: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const carrier = audioContext.createOscillator();
    carrier.frequency.setValueAtTime(this.midiToFrequency(midiNote), audioContext.currentTime);

    const modulator = audioContext.createOscillator();
    modulator.frequency.setValueAtTime(this.midiToFrequency(midiNote), audioContext.currentTime); // Simple 1:1 ratio
    
    const modulatorGain = audioContext.createGain();

    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);

    const noteGain = audioContext.createGain();
    noteGain.gain.setValueAtTime(0, audioContext.currentTime);
    noteGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.02);
    
    carrier.connect(noteGain);
    noteGain.connect(masterGain);

    const setTimbre = (value: number) => {
        // value 0-100 maps to modulation index
        const modAmount = value * 10;
        modulatorGain.gain.setTargetAtTime(modAmount, audioContext.currentTime, 0.01);
    };
    
    setTimbre(timbreValue);
    
    carrier.start();
    modulator.start();

    const stop = () => {
        const now = audioContext.currentTime;
        noteGain.gain.cancelScheduledValues(now);
        noteGain.gain.setValueAtTime(noteGain.gain.value, now);
        noteGain.gain.linearRampToValueAtTime(0, now + 0.2);
        carrier.stop(now + 0.2);
        modulator.stop(now + 0.2);
    };

    return { stop, setTimbre };
  }

  private createPianoVoice(midiNote: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.midiToFrequency(midiNote), audioContext.currentTime);

    const noteGain = audioContext.createGain();
    
    // Piano-like envelope
    const now = audioContext.currentTime;
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(0.8, now + 0.02); // Quick attack
    noteGain.gain.exponentialRampToValueAtTime(0.1, now + 0.5); // Decay

    const waveshaper = audioContext.createWaveShaper();
    
    osc.connect(waveshaper);
    waveshaper.connect(noteGain);
    noteGain.connect(masterGain);
    
    const setTimbre = (value: number) => {
      const amount = value / 100; // 0 to 1
      const k = 10 * amount; // Distortion amount
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
      }
      waveshaper.curve = curve;
      waveshaper.oversample = '4x';
    };

    setTimbre(timbreValue);
    osc.start();

    const stop = () => {
      const stopNow = audioContext.currentTime;
      noteGain.gain.cancelScheduledValues(stopNow);
      noteGain.gain.setValueAtTime(noteGain.gain.value, stopNow);
      noteGain.gain.linearRampToValueAtTime(0, stopNow + 0.15); // Short release
      osc.stop(stopNow + 0.15);
    };
    
    return { stop, setTimbre };
  }

  private createHangDrumVoice(midiNote: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const fundamentalFreq = this.midiToFrequency(midiNote);
    const now = audioContext.currentTime;

    // This gain node will handle the overall percussive envelope
    const envelope = audioContext.createGain();
    envelope.connect(masterGain);
    
    // ADSR-like envelope for a percussive sound
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.6, now + 0.01); // Quick attack, not too loud
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 4); // Long, natural decay

    // --- Oscillators ---
    const fundamentalOsc = audioContext.createOscillator();
    fundamentalOsc.type = 'sine';
    fundamentalOsc.frequency.value = fundamentalFreq;

    const partial1Osc = audioContext.createOscillator();
    partial1Osc.type = 'sine';
    partial1Osc.frequency.value = fundamentalFreq * 2.0; // Octave
    const partial1Gain = audioContext.createGain();

    const partial2Osc = audioContext.createOscillator();
    partial2Osc.type = 'sine';
    partial2Osc.frequency.value = fundamentalFreq * 3.0; // Fifth above octave
    const partial2Gain = audioContext.createGain();
    
    // Connect all sound sources to the main envelope
    fundamentalOsc.connect(envelope);
    partial1Osc.connect(partial1Gain);
    partial2Osc.connect(partial2Gain);
    partial1Gain.connect(envelope);
    partial2Gain.connect(envelope);
    
    const oscillators = [fundamentalOsc, partial1Osc, partial2Osc];
    oscillators.forEach(osc => osc.start(now));
    
    // The note will naturally stop playing after the envelope finishes.
    const stopTime = now + 4.1;
    oscillators.forEach(osc => osc.stop(stopTime));


    const setTimbre = (value: number) => {
      // Timbre morph controls the volume of the partials (harmonics)
      const partialsVolume = (value / 100);
      partial1Gain.gain.setTargetAtTime(0.5 * partialsVolume, audioContext.currentTime, 0.01);
      partial2Gain.gain.setTargetAtTime(0.3 * partialsVolume, audioContext.currentTime, 0.01);
    };

    setTimbre(timbreValue);

    const stop = () => {
      // For an immediate, forced stop (e.g., stopping an arp or note off)
      const stopNow = audioContext.currentTime;
      envelope.gain.cancelScheduledValues(stopNow);
      envelope.gain.setValueAtTime(envelope.gain.value, stopNow);
      envelope.gain.linearRampToValueAtTime(0, stopNow + 0.05); // Very quick release
    };
    
    return { stop, setTimbre };
  }

  private createStringMachineVoice(midiNote: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const noteGain = audioContext.createGain();
    const now = audioContext.currentTime;
    
    // Slow attack, long release envelope for a pad sound
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(0.5, now + 0.3); // Slow attack
    noteGain.connect(masterGain);

    const freq = this.midiToFrequency(midiNote);

    // Create three oscillators for a classic detuned string sound
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();
    
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc3.type = 'sawtooth';

    osc1.frequency.value = freq;

    osc1.connect(noteGain);
    osc2.connect(noteGain);
    osc3.connect(noteGain);

    const oscillators = [osc1, osc2, osc3];
    oscillators.forEach(osc => osc.start(now));

    const setTimbre = (value: number) => {
        // Timbre morph controls the detune amount in cents
        const detuneAmount = value * 0.2; // Max 20 cents
        osc2.detune.setTargetAtTime(detuneAmount, audioContext.currentTime, 0.01);
        osc3.detune.setTargetAtTime(-detuneAmount, audioContext.currentTime, 0.01);
    };

    setTimbre(timbreValue);

    const stop = () => {
      const stopNow = audioContext.currentTime;
      noteGain.gain.cancelScheduledValues(stopNow);
      noteGain.gain.setValueAtTime(noteGain.gain.value, stopNow);
      // Long release
      noteGain.gain.linearRampToValueAtTime(0, stopNow + 1.5); 
      oscillators.forEach(osc => osc.stop(stopNow + 1.5));
    };
    
    return { stop, setTimbre };
  }


  public stopNote(midiNote: number) {
    const activeNote = this.activeVoices.get(midiNote);
    if (activeNote) {
      activeNote.stop();
      this.activeVoices.delete(midiNote);
    }
  }

  public setTimbreParameter(value: number) {
    this.activeVoices.forEach((voice) => {
        voice.setTimbre(value);
    });
  }

  public setFilterCutoff(value: number) { // value is 0-100
    if (!this.filter || !this.audioContext) return;
    const minFreq = 40;
    const maxFreq = this.audioContext.sampleRate / 2;
    // Logarithmic scaling for more musical control
    const frequency = minFreq * Math.pow(maxFreq / minFreq, value / 100);
    this.filter.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.01);
  }

  public setFilterResonance(value: number) { // value is 0-100
    if (!this.filter || !this.audioContext) return;
    const resonance = (value / 100) * 20; // Q value from 0 to 20
    this.filter.Q.setTargetAtTime(resonance, this.audioContext.currentTime, 0.01);
  }

  public setFxDepth(value: number) { // value is 0-100, mapped to delay feedback
    if (!this.feedback || !this.audioContext) return;
    const feedbackAmount = (value / 100) * 0.7; // Max 0.7 to prevent runaway feedback
    this.feedback.gain.setTargetAtTime(feedbackAmount, this.audioContext.currentTime, 0.01);
  }

  public setMixFx(value: number) { // value is 0-100, mapped to delay time
    if (!this.delay || !this.audioContext) return;
     const delayTime = (value / 100) * 1.0;
     this.delay.delayTime.setTargetAtTime(delayTime, this.audioContext.currentTime, 0.01);
  }
}

export const audioService = new AudioService();