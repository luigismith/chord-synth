import React, { useState } from 'react';
import { Preset } from '../types';

interface PresetManagerProps {
  userPresets: Preset[];
  factoryPresets: Preset[];
  onSave: (name: string) => void;
  onLoad: (preset: Preset) => void;
  onDelete: (name: string) => void;
  morphA: string | null;
  morphB: string | null;
  morphAmount: number;
  onSetMorphA: (name: string | null) => void;
  onSetMorphB: (name: string | null) => void;
  onSetMorphAmount: (amount: number) => void;
}

const PresetManager: React.FC<PresetManagerProps> = ({
  userPresets,
  factoryPresets,
  onSave,
  onLoad,
  onDelete,
  morphA,
  morphB,
  morphAmount,
  onSetMorphA,
  onSetMorphB,
  onSetMorphAmount,
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const allPresets = [...factoryPresets, ...userPresets];

  const handleSaveClick = () => {
    if (newPresetName.trim()) {
      onSave(newPresetName.trim());
      setNewPresetName('');
    }
  };

  const handleLoadPreset = (name: string) => {
    const preset = allPresets.find(p => p.name === name);
    if(preset) {
        onLoad(preset);
    }
  }

  const getPresetDetails = (name: string | null): Preset | null => {
    if (!name) return null;
    return allPresets.find(p => p.name === name) || null;
  }

  const presetA = getPresetDetails(morphA);
  const presetB = getPresetDetails(morphB);


  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-xl uppercase tracking-widest text-cyan-400 neon-text-cyan font-['Russo_One']">
        Performance Presets
      </h3>

      {/* Save Preset Section */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          placeholder="New Preset Name"
          className="flex-grow bg-gray-800 border border-gray-600 rounded p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          onClick={handleSaveClick}
          className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-md uppercase text-sm tracking-widest hover:bg-cyan-500 transition-colors glow-cyan"
        >
          Save
        </button>
      </div>

       {/* Load/Delete Preset Section */}
      <div className="flex items-center space-x-2">
         <select onChange={(e) => handleLoadPreset(e.target.value)} defaultValue="" className="flex-grow bg-gray-800 border-2 border-cyan-500 neon-border-cyan text-cyan-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-400">
            <option value="" disabled>Load Preset</option>
             <optgroup label="User Presets">
                {userPresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
             </optgroup>
             <optgroup label="Factory Presets">
                {factoryPresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
             </optgroup>
         </select>
         <button
            onClick={() => {
                const select = document.querySelector('select');
                if (select && select.value && select.value !== '') {
                    if (window.confirm(`Are you sure you want to delete "${select.value}"?`)) {
                        onDelete(select.value);
                    }
                }
            }}
            className="px-4 py-2 bg-pink-700 text-white font-bold rounded-md uppercase text-sm tracking-widest hover:bg-pink-600 transition-colors glow-pink"
        >
            Delete
        </button>
      </div>

      {/* Morphing Section */}
      <div className="space-y-3 pt-2">
         <h4 className="text-lg text-pink-400 neon-text-pink">Preset Morphing</h4>
         <div className="grid grid-cols-2 gap-4">
             <div>
                <select value={morphA ?? ''} onChange={e => onSetMorphA(e.target.value || null)} className="bg-gray-800 border border-gray-600 rounded p-2 w-full">
                    <option value="">Select Morph A</option>
                    {allPresets.map(p => <option key={`A-${p.name}`} value={p.name}>{p.name}</option>)}
                </select>
                {presetA && <div className="text-xs text-cyan-300 mt-1 pl-1 truncate">{`${presetA.engine} | ${presetA.key} ${presetA.scale}`}</div>}
             </div>
             <div>
                <select value={morphB ?? ''} onChange={e => onSetMorphB(e.target.value || null)} className="bg-gray-800 border border-gray-600 rounded p-2 w-full">
                    <option value="">Select Morph B</option>
                    {allPresets.map(p => <option key={`B-${p.name}`} value={p.name}>{p.name}</option>)}
                </select>
                {presetB && <div className="text-xs text-pink-300 mt-1 pl-1 truncate">{`${presetB.engine} | ${presetB.key} ${presetB.scale}`}</div>}
            </div>
         </div>
         {morphA && morphB && (
            <div className="flex items-center space-x-4">
                <span className="text-sm font-bold text-cyan-300">A</span>
                 <input
                    type="range"
                    min="0"
                    max="100"
                    value={morphAmount}
                    onChange={(e) => onSetMorphAmount(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-bold text-pink-300">B</span>
            </div>
         )}
      </div>

    </div>
  );
};

export default PresetManager;
