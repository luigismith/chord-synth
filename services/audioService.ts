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
  private lastNoteFrequency: number | null = null;
  private glideTime: number = 0; // in seconds
  private adsr = {
    attack: 0.02,
    decay: 0.1,
    sustain: 0.8,
    release: 0.5,
  };

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
    
    const targetFrequency = this.midiToFrequency(midiNote);
    const isLegato = this.activeVoices.size > 0;
    const startFrequency = (isLegato && this.glideTime > 0 && this.lastNoteFrequency)
      ? this.lastNoteFrequency
      : targetFrequency;

    let voice: ActiveVoice;
    switch (this.currentEngine) {
      case 'FM':
        voice = this.createFMVoice(startFrequency, targetFrequency, timbreValue);
        break;
      case 'Reed Piano':
        voice = this.createPianoVoice(startFrequency, targetFrequency, timbreValue);
        break;
      case 'Hang Drum':
        voice = this.createHangDrumVoice(startFrequency, targetFrequency, timbreValue);
        break;
      case 'String Machine':
        voice = this.createStringMachineVoice(startFrequency, targetFrequency, timbreValue);
        break;
      case 'Analog':
      default:
        voice = this.createAnalogVoice(startFrequency, targetFrequency, timbreValue);
        break;
    }
    this.activeVoices.set(midiNote, voice);
    this.lastNoteFrequency = targetFrequency;
  }

  private applyAdsr(gainNode: GainNode, startTime: number) {
    const { attack, decay, sustain } = this.adsr;
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1.0, startTime + attack);
    gainNode.gain.setTargetAtTime(sustain, startTime + attack, decay / 3 + 0.001);
  }

  private triggerRelease(gainNode: GainNode, stopTime: number): number {
    const { release } = this.adsr;
    gainNode.gain.cancelScheduledValues(stopTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
    gainNode.gain.linearRampToValueAtTime(0, stopTime + release);
    return stopTime + release;
  }

  private createAnalogVoice(startFrequency: number, targetFrequency: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    const now = audioContext.currentTime;
    
    this.applyAdsr(noteGain, now);
    
    const setTimbre = (value: number) => {
        let type: OscillatorType = 'sine';
        if (value > 75) type = 'sawtooth';
        else if (value > 50) type = 'square';
        else if (value > 25) type = 'triangle';
        oscillator.type = type;
    };
    
    setTimbre(timbreValue);
    
    oscillator.frequency.setValueAtTime(startFrequency, now);
    if (startFrequency !== targetFrequency && this.glideTime > 0) {
        oscillator.frequency.linearRampToValueAtTime(targetFrequency, now + this.glideTime);
    }

    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start(now);

    const stop = () => {
      const stopNow = audioContext.currentTime;
      const releaseEndTime = this.triggerRelease(noteGain, stopNow);
      oscillator.stop(releaseEndTime);
    };

    return { stop, setTimbre };
  }
  
  private createFMVoice(startFrequency: number, targetFrequency: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const carrier = audioContext.createOscillator();
    const modulator = audioContext.createOscillator();
    const modulatorGain = audioContext.createGain();
    const noteGain = audioContext.createGain();
    const now = audioContext.currentTime;

    this.applyAdsr(noteGain, now);

    carrier.frequency.setValueAtTime(startFrequency, now);
    modulator.frequency.setValueAtTime(startFrequency, now); // Simple 1:1 ratio
    
    if (startFrequency !== targetFrequency && this.glideTime > 0) {
        const glideEndTime = now + this.glideTime;
        carrier.frequency.linearRampToValueAtTime(targetFrequency, glideEndTime);
        modulator.frequency.linearRampToValueAtTime(targetFrequency, glideEndTime);
    }

    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);
    
    carrier.connect(noteGain);
    noteGain.connect(masterGain);

    const setTimbre = (value: number) => {
        const modAmount = value * 10;
        modulatorGain.gain.setTargetAtTime(modAmount, audioContext.currentTime, 0.01);
    };
    
    setTimbre(timbreValue);
    
    carrier.start(now);
    modulator.start(now);

    const stop = () => {
        const stopNow = audioContext.currentTime;
        const releaseEndTime = this.triggerRelease(noteGain, stopNow);
        carrier.stop(releaseEndTime);
        modulator.stop(releaseEndTime);
    };

    return { stop, setTimbre };
  }

  private createPianoVoice(startFrequency: number, targetFrequency: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    const now = audioContext.currentTime;
    
    osc.frequency.setValueAtTime(startFrequency, now);
    if (startFrequency !== targetFrequency && this.glideTime > 0) {
        osc.frequency.linearRampToValueAtTime(targetFrequency, now + this.glideTime);
    }

    const noteGain = audioContext.createGain();
    this.applyAdsr(noteGain, now);

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
    osc.start(now);

    const stop = () => {
      const stopNow = audioContext.currentTime;
      const releaseEndTime = this.triggerRelease(noteGain, stopNow);
      osc.stop(releaseEndTime);
    };
    
    return { stop, setTimbre };
  }

  private createHangDrumVoice(startFrequency: number, targetFrequency: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const now = audioContext.currentTime;
    const envelope = audioContext.createGain();
    this.applyAdsr(envelope, now);
    envelope.connect(masterGain);
    
    const fundamentalOsc = audioContext.createOscillator();
    fundamentalOsc.type = 'sine';
    fundamentalOsc.frequency.setValueAtTime(startFrequency, now);

    const partial1Osc = audioContext.createOscillator();
    partial1Osc.type = 'sine';
    const partial1Gain = audioContext.createGain();

    const partial2Osc = audioContext.createOscillator();
    partial2Osc.type = 'sine';
    const partial2Gain = audioContext.createGain();
    
    if (startFrequency !== targetFrequency && this.glideTime > 0) {
        const glideEndTime = now + this.glideTime;
        fundamentalOsc.frequency.linearRampToValueAtTime(targetFrequency, glideEndTime);
        partial1Osc.frequency.linearRampToValueAtTime(targetFrequency * 2.0, glideEndTime);
        partial2Osc.frequency.linearRampToValueAtTime(targetFrequency * 3.0, glideEndTime);
    } else {
        partial1Osc.frequency.setValueAtTime(startFrequency * 2.0, now);
        partial2Osc.frequency.setValueAtTime(startFrequency * 3.0, now);
    }
    
    fundamentalOsc.connect(envelope);
    partial1Osc.connect(partial1Gain);
    partial2Osc.connect(partial2Gain);
    partial1Gain.connect(envelope);
    partial2Gain.connect(envelope);
    
    const oscillators = [fundamentalOsc, partial1Osc, partial2Osc];
    oscillators.forEach(osc => osc.start(now));
    
    const setTimbre = (value: number) => {
      const partialsVolume = (value / 100);
      partial1Gain.gain.setTargetAtTime(0.5 * partialsVolume, audioContext.currentTime, 0.01);
      partial2Gain.gain.setTargetAtTime(0.3 * partialsVolume, audioContext.currentTime, 0.01);
    };

    setTimbre(timbreValue);

    const stop = () => {
      const stopNow = audioContext.currentTime;
      const releaseEndTime = this.triggerRelease(envelope, stopNow);
      oscillators.forEach(osc => osc.stop(releaseEndTime));
    };
    
    return { stop, setTimbre };
  }

  private createStringMachineVoice(startFrequency: number, targetFrequency: number, timbreValue: number): ActiveVoice {
    const { audioContext, masterGain } = this;
    if (!audioContext || !masterGain) throw new Error("Audio context not ready");

    const noteGain = audioContext.createGain();
    const now = audioContext.currentTime;
    this.applyAdsr(noteGain, now);
    noteGain.connect(masterGain);

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const osc3 = audioContext.createOscillator();
    
    const oscillators = [osc1, osc2, osc3];
    oscillators.forEach(osc => {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(startFrequency, now);
        if (startFrequency !== targetFrequency && this.glideTime > 0) {
            osc.frequency.linearRampToValueAtTime(targetFrequency, now + this.glideTime);
        }
        osc.connect(noteGain);
        osc.start(now);
    });

    const setTimbre = (value: number) => {
        const detuneAmount = value * 0.2; // Max 20 cents
        osc2.detune.setTargetAtTime(detuneAmount, audioContext.currentTime, 0.01);
        osc3.detune.setTargetAtTime(-detuneAmount, audioContext.currentTime, 0.01);
    };

    setTimbre(timbreValue);

    const stop = () => {
      const stopNow = audioContext.currentTime;
      const releaseEndTime = this.triggerRelease(noteGain, stopNow);
      oscillators.forEach(osc => osc.stop(releaseEndTime));
    };
    
    return { stop, setTimbre };
  }


  public stopNote(midiNote: number) {
    const activeNote = this.activeVoices.get(midiNote);
    if (activeNote) {
      activeNote.stop();
      this.activeVoices.delete(midiNote);
    }
    if (this.activeVoices.size === 0) {
      this.lastNoteFrequency = null;
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

  public setGlideTime(value: number) { // value is 0-100
    // Use an exponential curve for a more musical feel, max 1.5s
    this.glideTime = Math.pow(value / 100, 2) * 1.5;
  }
  
  public setAdsr(attack: number, decay: number, sustain: number, release: number) {
    // values are 0-100 from knobs
    this.adsr.attack = 0.005 + Math.pow(attack / 100, 2) * 2; // 0 to 2s
    this.adsr.decay = 0.005 + Math.pow(decay / 100, 2) * 2; // 0 to 2s
    this.adsr.sustain = sustain / 100; // 0 to 1
    this.adsr.release = 0.005 + Math.pow(release / 100, 2) * 5; // 0 to 5s
  }
}

export const audioService = new AudioService();