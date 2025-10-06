
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KnobState, Preset, PadState, Chord, SynthEngine } from './types';
import { INITIAL_KNOBS, PRESETS, MIDI_KNOB_CC_MAP, KEYS, SCALES, ENGINES, MIDI_TRANSPORT_CC, PADS, MIDI_PAD_NOTE_MAP, MIDI_DIRECT_PARAM_CC_MAP } from './constants';
import ControlPanel from './components/ControlPanel';
import PadBank from './components/PadBank';
import VisualizerCanvas from './components/VisualizerCanvas';
import PresetManager from './components/PresetManager';
import { MidiService } from './services/midiService';
import { audioService } from './services/audioService';
import { generateChordProgression } from './services/geminiService';
import CustomSelect from './components/CustomSelect';
import GlobalControls from './components/GlobalControls';
import HarmonyGenerator from './components/HarmonyGenerator';
import EnvelopePanel from './components/EnvelopePanel';

const USER_PRESETS_STORAGE_KEY = 'orchid_synth_user_presets';

const App: React.FC = () => {
  const [knobs, setKnobs] = useState<KnobState[]>(INITIAL_KNOBS);
  const [midiDevices, setMidiDevices] = useState<string[]>([]);
  const [activePads, setActivePads] = useState<number[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('C');
  const [selectedScale, setSelectedScale] = useState<string>('Minor');
  const [selectedEngine, setSelectedEngine] = useState<SynthEngine>('Analog');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [chords, setChords] = useState<Chord[]>([
      { name: "Am7", notes: [] },
      { name: "G", notes: [] },
      { name: "C", notes: [] },
      { name: "F", notes: [] },
  ]);
  const [arpIsActive, setArpIsActive] = useState(false);
  const [arpPattern, setArpPattern] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTransport, setActiveTransport] = useState<string | null>(null);
  const [activeHarmonyPads, setActiveHarmonyPads] = useState<number[]>([]);

  // MIDI Clock Sync State
  const [isMidiClockSynced, setIsMidiClockSynced] = useState(false);
  const [externalBpm, setExternalBpm] = useState<number | null>(null);
  const [lastBeatTimestamp, setLastBeatTimestamp] = useState<number>(0);
  const [lastOffBeatTimestamp, setLastOffBeatTimestamp] = useState<number>(0);

  // Preset Management State
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [morphA, setMorphA] = useState<string | null>(null);
  const [morphB, setMorphB] = useState<string | null>(null);
  const [morphAmount, setMorphAmount] = useState(0);


  // Refs
  const midiServiceRef = useRef<MidiService>(new MidiService());
  const heldKeys = useRef<Set<number>>(new Set());
  const arpTimeoutId = useRef<number | null>(null);
  const sustainedNoteTimeouts = useRef<Map<number, number>>(new Map());
  const arpStep = useRef(0);
  const lastArpNote = useRef<number | null>(null);
  const activeChordNotes = useRef<number[]>([]);
  const clockTickCount = useRef(0);
  const bpmTimestamps = useRef<number[]>([]);


  const handleKnobChange = useCallback((id: number, value: number) => {
    setKnobs((prevKnobs) =>
      prevKnobs.map((k) => (k.id === id ? { ...k, value } : k))
    );
  }, []);

  const stopArp = useCallback(() => {
    // Clear internal timer if it's running
    if (arpTimeoutId.current) clearTimeout(arpTimeoutId.current);
    arpTimeoutId.current = null;

    // Stop any currently sounding arp notes
    const notesToStop = new Set<number>(sustainedNoteTimeouts.current.keys());
    if (lastArpNote.current !== null) {
        notesToStop.add(lastArpNote.current);
    }
    notesToStop.forEach(note => audioService.stopNote(note));
    
    // Clear pending note-off events
    sustainedNoteTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    sustainedNoteTimeouts.current.clear();

    lastArpNote.current = null;
    arpStep.current = 0;
  }, []);
    
  // Maps Arp Density knob (0-100) to standard MIDI clock divisions
  const getArpDivider = (density: number): number => {
    // 24 ticks = quarter note
    if (density < 17) return 24; // 1/4 note
    if (density < 34) return 12; // 1/8 note
    if (density < 50) return 8;  // 1/8 note triplet
    if (density < 67) return 6;  // 1/16 note
    if (density < 84) return 4;  // 1/16 note triplet
    return 3;                    // 1/32 note
  };

  const arpStepForward = useCallback(() => {
      const notes = Array.from(heldKeys.current).sort((a, b) => a - b);
      if (notes.length === 0) return;

      let noteToPlay: number | null = null;
      const currentStep = arpStep.current % notes.length;

      switch (arpPattern) {
        case 'down': noteToPlay = notes[notes.length - 1 - currentStep]; break;
        case 'random': noteToPlay = notes[Math.floor(Math.random() * notes.length)]; break;
        default: noteToPlay = notes[currentStep]; break;
      }
      const noteToStop = lastArpNote.current;
      if (noteToPlay !== null) {
        const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
        audioService.playNote(noteToPlay, timbreValue);
        lastArpNote.current = noteToPlay;
      }

      if (noteToStop !== null && noteToStop !== noteToPlay) {
        if (sustainedNoteTimeouts.current.has(noteToStop)) {
            clearTimeout(sustainedNoteTimeouts.current.get(noteToStop)!);
        }
        
        const releaseKnob = knobs.find(k => k.id === 13)?.value ?? 30; // Use Release knob for gate length
        const sustainRatio = 0.1 + (releaseKnob / 100) * 0.9; // Map 0-100 to 10%-100% gate length

        let stopDelay: number;

        if (isMidiClockSynced && bpmTimestamps.current.length > 2) {
            const first = bpmTimestamps.current[0];
            const last = bpmTimestamps.current[bpmTimestamps.current.length - 1];
            const ticks = bpmTimestamps.current.length - 1;
            const avgMsPerTick = (last - first) / ticks;
            
            const densityKnob = knobs.find(k => k.id === 2)?.value ?? 50;
            const arpDivider = getArpDivider(densityKnob);
            const stepDurationMs = avgMsPerTick * arpDivider;
            
            stopDelay = stepDurationMs * sustainRatio;
        } else {
            const densityKnob = knobs.find(k => k.id === 2)?.value ?? 50;
            const baseInterval = 600 - (densityKnob * 5.5);
            stopDelay = baseInterval * sustainRatio;
        }

        const timeoutId = window.setTimeout(() => {
          audioService.stopNote(noteToStop);
          sustainedNoteTimeouts.current.delete(noteToStop);
        }, Math.max(10, stopDelay));
        sustainedNoteTimeouts.current.set(noteToStop, timeoutId);
      }
      arpStep.current++;
  }, [knobs, arpPattern, isMidiClockSynced]);
  
  const arpTick = useCallback(() => {
    if (!arpIsActive || heldKeys.current.size === 0 || isMidiClockSynced) {
      stopArp();
      return;
    }
    
    arpStepForward();
    
    const density = knobs.find(k => k.id === 2)?.value ?? 50;
    const baseInterval = 600 - (density * 5.5);
    const swing = knobs.find(k => k.id === 3)?.value ?? 0;
    let nextInterval = baseInterval;
    const swingAmount = (swing / 100) * 0.66;
    if (arpStep.current % 2 !== 0) nextInterval = baseInterval * (1 + swingAmount);
    else nextInterval = baseInterval * (1 - swingAmount);
    arpTimeoutId.current = window.setTimeout(arpTick, Math.max(50, nextInterval));
  }, [knobs, arpIsActive, stopArp, arpStepForward, isMidiClockSynced]);

  const startArp = useCallback(() => {
    stopArp();
    if (isMidiClockSynced) return; // Don't start internal timer if synced
    arpStep.current = 0;
    arpTick();
  }, [stopArp, arpTick, isMidiClockSynced]);

  const handlePadPress = useCallback((pad: PadState) => {
    setActivePads(prev => [...prev, pad.id]);
    if (pad.type === 'arp') {
        if (arpPattern === pad.value) {
            setArpIsActive(false);
            setArpPattern(null);
            stopArp();
        } else {
            setArpPattern(pad.value);
            setArpIsActive(true);
            if (heldKeys.current.size > 0 && !isMidiClockSynced) {
               startArp();
            }
        }
    } else if (pad.type === 'chord') {
       activeChordNotes.current.forEach(note => audioService.stopNote(note));
       const chordToPlay = chords[pad.id - 1]; // pad.id is 1-based
       if (chordToPlay) {
         const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
         const notesPlayed = audioService.playChord(chordToPlay.name, selectedKey, selectedScale, timbreValue);
         activeChordNotes.current = notesPlayed;
       }
   }
 }, [arpPattern, chords, knobs, selectedKey, selectedScale, startArp, stopArp, isMidiClockSynced]);

  const handlePadRelease = useCallback((pad: PadState) => {
    setActivePads(prev => prev.filter(pId => pId !== pad.id));
    if (pad.type === 'chord') {
        activeChordNotes.current.forEach(note => audioService.stopNote(note));
        activeChordNotes.current = [];
    }
  }, []);

  const handleNoteOn = useCallback((note: number, velocity: number) => {
    const padId = MIDI_PAD_NOTE_MAP[note];
    if (padId) {
        const pad = PADS.find(p => p.id === padId);
        if (pad) {
            handlePadPress(pad);
            return; // Note is a pad, so don't treat it as a melodic note
        }
    }

    const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
    if (arpIsActive) {
      const wasEmpty = heldKeys.current.size === 0;
      heldKeys.current.add(note);
      if (wasEmpty && !isMidiClockSynced) startArp();
    } else {
      audioService.playNote(note, timbreValue);
    }
  }, [arpIsActive, startArp, knobs, handlePadPress, isMidiClockSynced]);

  const handleNoteOff = useCallback((note: number) => {
    const padId = MIDI_PAD_NOTE_MAP[note];
    if (padId) {
        const pad = PADS.find(p => p.id === padId);
        if (pad) {
            handlePadRelease(pad);
            return; // Note is a pad
        }
    }

    if (arpIsActive) {
      heldKeys.current.delete(note);
      if (heldKeys.current.size === 0 && !isMidiClockSynced) stopArp();
    } else {
      audioService.stopNote(note);
    }
  }, [arpIsActive, stopArp, handlePadRelease, isMidiClockSynced]);

  const handlePlay = useCallback(() => {
    if (isMidiClockSynced) return;
    if (arpPattern) {
      setArpIsActive(true);
      if (heldKeys.current.size > 0) {
          startArp();
      }
    }
  }, [arpPattern, startArp, isMidiClockSynced]);

  const handleStop = useCallback(() => {
      if (isMidiClockSynced) return;
      if (arpIsActive) {
          setArpIsActive(false);
          stopArp();
      }
  }, [arpIsActive, stopArp, isMidiClockSynced]);

  const handleRecord = useCallback(() => {
      setIsRecording(prev => !prev);
  }, []);
  
  const handleMidiStart = useCallback(() => {
    setIsMidiClockSynced(true);
    setArpIsActive(true);
    clockTickCount.current = 0;
    arpStep.current = 0;
    bpmTimestamps.current = [];
  }, []);
  
  const handleMidiContinue = useCallback(() => {
    setIsMidiClockSynced(true);
    setArpIsActive(true);
  }, []);

  const handleMidiStop = useCallback(() => {
    setIsMidiClockSynced(false);
    setArpIsActive(false);
    setExternalBpm(null);
    stopArp();
  }, [stopArp]);

  const handleMidiClock = useCallback(() => {
    if (!isMidiClockSynced && clockTickCount.current > 0) return; // Ignore stray clocks if not started
    if (!isMidiClockSynced) setIsMidiClockSynced(true);

    const now = performance.now();
    bpmTimestamps.current.push(now);
    if (bpmTimestamps.current.length > 48) {
        bpmTimestamps.current.shift();
    }

    if (bpmTimestamps.current.length > 2) {
      const first = bpmTimestamps.current[0];
      const last = bpmTimestamps.current[bpmTimestamps.current.length - 1];
      const ticks = bpmTimestamps.current.length - 1;
      const avgMsPerTick = (last - first) / ticks;
      const bpm = 60000 / (avgMsPerTick * 24);
      setExternalBpm(Math.round(bpm));
    }
    
    const masterClock = clockTickCount.current++;
    const tickInBeat = masterClock % 24;
    
    // Main beat visualization trigger (quarter note)
    if (tickInBeat === 0) {
        setLastBeatTimestamp(performance.now());
    }
    
    const swingKnobValue = knobs.find(k => k.id === 3)?.value ?? 0;

    // Off-beat swing visualization trigger
    if (swingKnobValue > 0) {
        // Standard swing ratio: max delay is 2/3 of an 8th note's duration.
        const swingRatio = (swingKnobValue / 100) * (2/3);
        // An 8th note is 12 MIDI clock ticks.
        const swingDelayInTicks = Math.round(12 * swingRatio);
        const offBeatTickPosition = 12 + swingDelayInTicks;

        if (tickInBeat === offBeatTickPosition) {
            setLastOffBeatTimestamp(performance.now());
        }
    }
    
    if(arpIsActive && arpPattern && heldKeys.current.size > 0) {
      const densityKnobValue = knobs.find(k => k.id === 2)?.value ?? 50;
      const arpDivider = getArpDivider(densityKnobValue);
      let shouldTrigger = false;
      
      if (swingKnobValue === 0) {
          if (masterClock % arpDivider === 0) {
              shouldTrigger = true;
          }
      } else {
          const periodInTicks = arpDivider * 2; 
          const tickWithinPeriod = masterClock % periodInTicks;
          const swingRatio = (swingKnobValue / 100) * (2/3);
          const swingDelayInTicks = Math.round(arpDivider * swingRatio);
          const onBeatTick = 0;
          const offBeatTick = Math.min(arpDivider + swingDelayInTicks, periodInTicks - 1);
          
          if (tickWithinPeriod === onBeatTick || tickWithinPeriod === offBeatTick) {
              shouldTrigger = true;
          }
      }

      if(shouldTrigger) {
        arpStepForward();
      }
    }

  }, [isMidiClockSynced, arpIsActive, arpPattern, knobs, arpStepForward]);

  const handleControlChange = useCallback((controller: number, value: number) => {
    const knobId = MIDI_KNOB_CC_MAP[controller];
    if (knobId) {
      handleKnobChange(knobId, Math.round((value / 127) * 100));
    }

    const directParam = MIDI_DIRECT_PARAM_CC_MAP[controller];
    if (directParam) {
        let knobToUpdateId: number | null = null;
        switch(directParam) {
            case 'glide': knobToUpdateId = 9; break;
            case 'filterResonance': knobToUpdateId = 6; break;
            case 'fxDepth': knobToUpdateId = 4; break;
            case 'mixFx': knobToUpdateId = 8; break;
            case 'attack': knobToUpdateId = 10; break;
            case 'decay': knobToUpdateId = 11; break;
            case 'sustain': knobToUpdateId = 12; break;
            case 'release': knobToUpdateId = 13; break;
        }
        if (knobToUpdateId !== null) {
            handleKnobChange(knobToUpdateId, Math.round((value / 127) * 100));
        }
    }

    if (value > 64) {
      switch (controller) {
        case MIDI_TRANSPORT_CC.PLAY:
          handlePlay();
          setActiveTransport('play');
          setTimeout(() => setActiveTransport(null), 150);
          break;
        case MIDI_TRANSPORT_CC.STOP:
          handleStop();
          setActiveTransport('stop');
          setTimeout(() => setActiveTransport(null), 150);
          break;
        case MIDI_TRANSPORT_CC.RECORD:
          handleRecord();
          break;
        default:
          break;
      }
    }
  }, [handleKnobChange, handlePlay, handleStop, handleRecord]);
  
  useEffect(() => {
    const connect = async () => {
        const devices = await midiServiceRef.current.requestMIDIAccess();
        setMidiDevices(devices);
    };
    connect();
  }, []);

  useEffect(() => {
    const service = midiServiceRef.current;
    service.onNoteOn = handleNoteOn;
    service.onNoteOff = handleNoteOff;
    service.onControlChange = handleControlChange;
    service.onStart = handleMidiStart;
    service.onContinue = handleMidiContinue;
    service.onStop = handleMidiStop;
    service.onClock = handleMidiClock;
  }, [handleNoteOn, handleNoteOff, handleControlChange, handleMidiStart, handleMidiContinue, handleMidiStop, handleMidiClock]);

  useEffect(() => {
    // Synth Parameters
    const getValue = (id: number) => knobs.find(k => k.id === id)?.value ?? 0;
    audioService.setFilterCutoff(getValue(5));
    audioService.setFilterResonance(getValue(6));
    audioService.setFxDepth(getValue(4));
    audioService.setMixFx(getValue(8));
    audioService.setTimbreParameter(getValue(7));
    audioService.setGlideTime(getValue(9));
    
    // ADSR Envelope
    audioService.setAdsr(
      getValue(10), // Attack
      getValue(11), // Decay
      getValue(12), // Sustain
      getValue(13)  // Release
    );

  }, [knobs]);

  const handleHarmonyPadPress = (chordIndex: number) => {
      setActiveHarmonyPads(prev => [...prev, chordIndex]);
      activeChordNotes.current.forEach(note => audioService.stopNote(note));
      const chordToPlay = chords[chordIndex];
      if (chordToPlay) {
          const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
          const notesPlayed = audioService.playChord(chordToPlay.name, selectedKey, selectedScale, timbreValue);
          activeChordNotes.current = notesPlayed;
      }
  };

  const handleHarmonyPadRelease = (chordIndex: number) => {
      setActiveHarmonyPads(prev => prev.filter(pId => pId !== chordIndex));
      activeChordNotes.current.forEach(note => audioService.stopNote(note));
      activeChordNotes.current = [];
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const newChords = await generateChordProgression(selectedKey, selectedScale);
    if (newChords && newChords.length > 0) {
      setChords(newChords);
    }
    setIsGenerating(false);
  };

  const handleEngineChange = useCallback((engine: SynthEngine) => {
    setSelectedEngine(engine);
    audioService.setEngine(engine);
  }, []);

  useEffect(() => {
    try {
        const storedPresets = localStorage.getItem(USER_PRESETS_STORAGE_KEY);
        if (storedPresets) setUserPresets(JSON.parse(storedPresets));
    } catch (error) { console.error("Failed to load user presets:", error); }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(userPresets));
    } catch (error) { console.error("Failed to save user presets:", error); }
  }, [userPresets]);

  const handleSavePreset = (name: string) => {
    const newPreset: Preset = { name, knobs: JSON.parse(JSON.stringify(knobs)), engine: selectedEngine, key: selectedKey, scale: selectedScale };
    setUserPresets(prev => {
        const existing = prev.findIndex(p => p.name === name);
        if (existing > -1) { const updated = [...prev]; updated[existing] = newPreset; return updated; }
        return [...prev, newPreset];
    });
  };

  const handleLoadPreset = useCallback((preset: Preset) => {
    setKnobs(preset.knobs);
    handleEngineChange(preset.engine);
    setSelectedKey(preset.key);
    setSelectedScale(preset.scale);
    // Reset morphing when a preset is loaded directly for a cleaner workflow
    setMorphA(null);
    setMorphB(null);
    setMorphAmount(0);
  }, [handleEngineChange]);

  const handleDeletePreset = (name: string) => {
    setUserPresets(prev => prev.filter(p => p.name !== name));
  }

  // Refined Preset Morphing Logic
  useEffect(() => {
    if (!morphA || !morphB) {
      return; // Exit if morphing isn't active
    }

    const allPresets = [...PRESETS, ...userPresets];
    const presetA = allPresets.find(p => p.name === morphA);
    const presetB = allPresets.find(p => p.name === morphB);

    if (presetA && presetB) {
      const blend = morphAmount / 100;

      // 1. Morph continuous knob values
      const morphedKnobs = presetA.knobs.map((knobA) => {
        const knobB = presetB.knobs.find(k => k.id === knobA.id);
        if (!knobB) return knobA; // Should not happen if presets are valid
        const value = knobA.value + (knobB.value - knobA.value) * blend;
        return { ...knobA, value: Math.round(value) };
      });
      setKnobs(morphedKnobs);

      // 2. Determine the target for discrete values
      const targetPreset = blend < 0.5 ? presetA : presetB;

      // 3. Update discrete values if they differ from current state
      if (selectedEngine !== targetPreset.engine) {
        handleEngineChange(targetPreset.engine);
      }
      if (selectedKey !== targetPreset.key) {
        setSelectedKey(targetPreset.key);
      }
      if (selectedScale !== targetPreset.scale) {
        setSelectedScale(targetPreset.scale);
      }
    }
  }, [morphA, morphB, morphAmount, userPresets, handleEngineChange, selectedEngine, selectedKey, selectedScale]);
  
  const synthKnobs = knobs.filter(k => k.id <= 9);
  const envKnobs = knobs.filter(k => k.id > 9);
  const swingAmount = knobs.find(k => k.id === 3)?.value ?? 0;

  return (
    <div className="h-screen bg-[#0c0a1a] p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
      <main className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
          {/* LEFT COMMAND PANEL */}
          <aside className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col gap-6">
              <GlobalControls 
                  arpIsActive={arpIsActive && arpPattern !== null}
                  isRecording={isRecording}
                  activeTransport={activeTransport}
                  handlePlay={handlePlay}
                  handleStop={handleStop}
                  handleRecord={handleRecord}
                  midiDevices={midiDevices}
                  onConnectMidi={() => midiServiceRef.current.requestMIDIAccess()}
                  isMidiClockSynced={isMidiClockSynced}
                  externalBpm={externalBpm}
                  lastBeatTimestamp={lastBeatTimestamp}
                  lastOffBeatTimestamp={lastOffBeatTimestamp}
                  swingAmount={swingAmount}
              />
              <PadBank onPadPress={handlePadPress} onPadRelease={handlePadRelease} activePads={activePads} armedPadValue={arpPattern} chords={chords} />
              <HarmonyGenerator chords={chords} isLoading={isGenerating} onGenerate={handleGenerate} onPadPress={handleHarmonyPadPress} onPadRelease={handleHarmonyPadRelease} activePads={activeHarmonyPads}/>
              <PresetManager userPresets={userPresets} factoryPresets={PRESETS} onSave={handleSavePreset} onLoad={handleLoadPreset} onDelete={handleDeletePreset} morphA={morphA} morphB={morphB} morphAmount={morphAmount} onSetMorphA={setMorphA} onSetMorphB={setMorphB} onSetMorphAmount={setMorphAmount}/>
          </aside>
          
          {/* CENTRAL VISUALIZER */}
          <div className="flex-grow flex flex-col gap-6 min-h-[400px] lg:min-h-0">
              <VisualizerCanvas knobs={knobs} />
          </div>

          {/* RIGHT SYNTH CONTROLS */}
          <aside className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col gap-6">
              <ControlPanel knobs={synthKnobs} onKnobChange={handleKnobChange} arpIsActive={arpIsActive && arpPattern !== null} />
              <EnvelopePanel knobs={envKnobs} onKnobChange={handleKnobChange} />
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex flex-col gap-4">
                 <CustomSelect label="KEY" value={selectedKey} onChange={setSelectedKey} options={KEYS} />
                 <CustomSelect label="SCALE" value={selectedScale} onChange={setSelectedScale} options={SCALES} />
                 {/* FIX: Corrected typo from ENGNES to ENGINES */}
                 <CustomSelect label="ENGINE" value={selectedEngine} onChange={(val) => handleEngineChange(val as SynthEngine)} options={ENGINES} />
              </div>
          </aside>
      </main>
    </div>
  );
};

export default App;
