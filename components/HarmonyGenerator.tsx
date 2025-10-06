import React from 'react';
import { Chord } from '../types';

interface HarmonyGeneratorProps {
    chords: Chord[];
    isLoading: boolean;
    onGenerate: () => void;
}

const HarmonyGenerator: React.FC<HarmonyGeneratorProps> = ({ chords, isLoading, onGenerate }) => {
    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-4">
            <h3 className="text-xl uppercase tracking-widest text-pink-400 neon-text-pink font-['Russo_One']">
                AI Harmony
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {chords.map((chord, index) => (
                    <div key={index} className="h-20 bg-gray-900/70 border-2 border-pink-500 rounded-md flex items-center justify-center text-pink-200 text-xl font-bold neon-border-pink hover:bg-gray-800 transition-colors">
                        {chord.name}
                    </div>
                ))}
            </div>
            <button
                onClick={onGenerate}
                disabled={isLoading}
                className="w-full px-8 py-3 bg-pink-600 text-white font-bold rounded-md uppercase tracking-widest hover:bg-pink-500 transition-all duration-200 transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed glow-pink"
            >
                {isLoading ? 'Generating...' : 'Generate Sequence'}
            </button>
            <p className="text-xs text-gray-400 text-center">
                Ask Gemini for a new Synthwave chord progression.
            </p>
        </div>
    );
};

export default HarmonyGenerator;
