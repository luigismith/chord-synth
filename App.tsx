import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KnobState, Preset, PadState, Chord, SynthEngine } from './types';
import { INITIAL_KNOBS, PRESETS, MIDI_KNOB_CC_MAP, KEYS, SCALES, ENGINES, MIDI_TRANSPORT_CC, PADS } from './constants';
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

  // Preset Management State
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [morphA, setMorphA] = useState<string | null>(null);
  const [morphB, setMorphB] = useState<string | null>(null);
  const [morphAmount, setMorphAmount] = useState(0);


  // Instantiate the MidiService once and store it in a ref.
  const midiServiceRef = useRef<MidiService>(new MidiService());
  const heldKeys = useRef<Set<number>>(new Set());
  const arpTimeoutId = useRef<number | null>(null);
  const sustainedNoteTimeouts = useRef<Map<number, number>>(new Map());
  const arpStep = useRef(0);
  const lastArpNote = useRef<number | null>(null);
  const activeChordNotes = useRef<number[]>([]);

  const handleKnobChange = useCallback((id: number, value: number) => {
    setKnobs((prevKnobs) =>
      prevKnobs.map((k) => (k.id === id ? { ...k, value } : k))
    );
  }, []);

  const stopArp = useCallback(() => {
    if (arpTimeoutId.current) clearTimeout(arpTimeoutId.current);
    arpTimeoutId.current = null;

    const notesToStop = new Set<number>(sustainedNoteTimeouts.current.keys());
    if (lastArpNote.current !== null) {
        notesToStop.add(lastArpNote.current);
    }
    
    notesToStop.forEach(note => {
        audioService.stopNote(note);
    });
    
    sustainedNoteTimeouts.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
    });
    sustainedNoteTimeouts.current.clear();

    lastArpNote.current = null;
    arpStep.current = 0;
  }, []);
  
  const arpTick = useCallback(() => {
    if (!arpIsActive || heldKeys.current.size === 0) {
      stopArp();
      return;
    }
    const notes = Array.from(heldKeys.current).sort((a, b) => a - b);
    if (notes.length === 0) {
      stopArp();
      return;
    }

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
    const density = knobs.find(k => k.id === 2)?.value ?? 50;
    const baseInterval = 600 - (density * 5.5);
    if (noteToStop !== null && noteToStop !== noteToPlay) {
      if (sustainedNoteTimeouts.current.has(noteToStop)) {
          clearTimeout(sustainedNoteTimeouts.current.get(noteToStop)!);
      }
      const complexity = knobs.find(k => k.id === 1)?.value ?? 30;
      const complexityFactor = complexity / 100;
      const sustainRatio = 0.25 + Math.pow(complexityFactor, 1.5) * 2.25;
      const stopDelay = baseInterval * sustainRatio;

      const timeoutId = window.setTimeout(() => {
        audioService.stopNote(noteToStop);
        sustainedNoteTimeouts.current.delete(noteToStop);
      }, Math.max(10, stopDelay));
      sustainedNoteTimeouts.current.set(noteToStop, timeoutId);
    }
    arpStep.current++;
    const swing = knobs.find(k => k.id === 3)?.value ?? 0;
    let nextInterval = baseInterval;
    const swingAmount = (swing / 100) * 0.66;
    if (arpStep.current % 2 !== 0) nextInterval = baseInterval * (1 + swingAmount);
    else nextInterval = baseInterval * (1 - swingAmount);
    arpTimeoutId.current = window.setTimeout(arpTick, Math.max(50, nextInterval));
  }, [knobs, arpIsActive, arpPattern, stopArp]);

  const startArp = useCallback(() => {
    stopArp();
    arpStep.current = 0;
    arpTick();
  }, [stopArp, arpTick]);

  const handleNoteOn = useCallback((note: number, velocity: number) => {
    const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
    if (arpIsActive) {
      const wasEmpty = heldKeys.current.size === 0;
      heldKeys.current.add(note);
      if (wasEmpty) startArp();
    } else {
      audioService.playNote(note, timbreValue);
    }
  }, [arpIsActive, startArp, knobs]);

  const handleNoteOff = useCallback((note: number) => {
    if (arpIsActive) {
      heldKeys.current.delete(note);
      if (heldKeys.current.size === 0) stopArp();
    } else {
      audioService.stopNote(note);
    }
  }, [arpIsActive, stopArp]);

    const handlePlay = useCallback(() => {
      if (arpPattern) {
        setArpIsActive(true);
        if (heldKeys.current.size > 0) {
            startArp();
        }
      }
    }, [arpPattern, startArp]);

    const handleStop = useCallback(() => {
        if (arpIsActive) {
            setArpIsActive(false);
            stopArp();
        }
    }, [arpIsActive, stopArp]);

    const handleRecord = useCallback(() => {
        setIsRecording(prev => !prev);
    }, []);

  const handleControlChange = useCallback((controller: number, value: number) => {
    const knobId = MIDI_KNOB_CC_MAP[controller];
    if (knobId) {
      handleKnobChange(knobId, Math.round((value / 127) * 100));
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
  }, [handleNoteOn, handleNoteOff, handleControlChange]);

  useEffect(() => {
    const filterCutoffKnob = knobs.find(k => k.id === 5);
    if (filterCutoffKnob) audioService.setFilterCutoff(filterCutoffKnob.value);
    const filterResKnob = knobs.find(k => k.id === 6);
    if (filterResKnob) audioService.setFilterResonance(filterResKnob.value);
    const fxDepthKnob = knobs.find(k => k.id === 4);
    if (fxDepthKnob) audioService.setFxDepth(fxDepthKnob.value);
    const mixFxKnob = knobs.find(k => k.id === 8);
    if (mixFxKnob) audioService.setMixFx(mixFxKnob.value);
    const timbreKnob = knobs.find(k => k.id === 7);
    if (timbreKnob) audioService.setTimbreParameter(timbreKnob.value);
  }, [knobs]);

  const handlePadPress = (pad: PadState) => {
     setActivePads(prev => [...prev, pad.id]);
     if (pad.type === 'arp') {
         if (arpPattern === pad.value) {
             setArpIsActive(false);
             setArpPattern(null);
             stopArp();
         } else {
             setArpPattern(pad.value);
             if (arpIsActive && heldKeys.current.size > 0) {
                startArp();
             }
         }
     } else if (pad.type === 'chord') {
        activeChordNotes.current.forEach(note => audioService.stopNote(note));
        const timbreValue = knobs.find(k => k.id === 7)?.value ?? 0;
        const notesPlayed = audioService.playChord(pad.value, selectedKey, selectedScale, timbreValue);
        activeChordNotes.current = notesPlayed;
    }
  };

  const handlePadRelease = (pad: PadState) => {
    setActivePads(prev => prev.filter(pId => pId !== pad.id));
    if (pad.type === 'chord') {
        activeChordNotes.current.forEach(note => audioService.stopNote(note));
        activeChordNotes.current = [];
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const newChords = await generateChordProgression(selectedKey, selectedScale);
    setChords(newChords);
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
      const morphedKnobs = presetA.knobs.map((knobA, index) => {
        const knobB = presetB.knobs[index];
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


  return (
    <div className="h-screen bg-[#0c0a1a] p-4 sm:p-6 lg:p-8 flex flex-col space-y-4 overflow-y-auto lg:overflow-hidden">
      <main className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
          {/* LEFT COMMAND PANEL */}
          <aside className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col gap-6">
              <GlobalControls 
                  arpIsActive={arpPattern !== null}
                  isRecording={isRecording}
                  activeTransport={activeTransport}
                  handlePlay={handlePlay}
                  handleStop={handleStop}
                  handleRecord={handleRecord}
                  midiDevices={midiDevices}
                  onConnectMidi={() => midiServiceRef.current.requestMIDIAccess()}
              />
              <PadBank onPadPress={handlePadPress} onPadRelease={handlePadRelease} activePads={activePads} armedPadValue={arpPattern} />
              <HarmonyGenerator chords={chords} isLoading={isGenerating} onGenerate={handleGenerate} />
              <PresetManager userPresets={userPresets} factoryPresets={PRESETS} onSave={handleSavePreset} onLoad={handleLoadPreset} onDelete={handleDeletePreset} morphA={morphA} morphB={morphB} morphAmount={morphAmount} onSetMorphA={setMorphA} onSetMorphB={setMorphB} onSetMorphAmount={setMorphAmount}/>
          </aside>
          
          {/* CENTRAL VISUALIZER */}
          <div className="flex-grow flex flex-col gap-6 min-h-[400px] lg:min-h-0">
              <VisualizerCanvas knobs={knobs} />
          </div>

          {/* RIGHT SYNTH CONTROLS */}
          <aside className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col gap-6">
              <ControlPanel knobs={knobs} onKnobChange={handleKnobChange} arpIsActive={arpPattern !== null} />
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex flex-col gap-4">
                 <CustomSelect label="KEY" value={selectedKey} onChange={setSelectedKey} options={KEYS} />
                 <CustomSelect label="SCALE" value={selectedScale} onChange={setSelectedScale} options={SCALES} />
                 <CustomSelect label="ENGINE" value={selectedEngine} onChange={(val) => handleEngineChange(val as SynthEngine)} options={ENGINES} />
              </div>
          </aside>
      </main>
    </div>
  );
};

export default App;
