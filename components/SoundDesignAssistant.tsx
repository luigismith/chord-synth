import React from 'react';

interface SoundDesignAssistantProps {
    onGenerateTip: () => void;
    tip: string;
    isLoading: boolean;
}

const SoundDesignAssistant: React.FC<SoundDesignAssistantProps> = ({ onGenerateTip, tip, isLoading }) => {
    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 space-y-4">
            <h3 className="text-xl uppercase tracking-widest text-cyan-400 neon-text-cyan font-['Russo_One']">
                AI Sound Design
            </h3>
            
            <div className="bg-black/50 p-3 rounded-md border border-cyan-800 min-h-[100px] font-mono text-cyan-300 text-sm flex items-center justify-center text-center">
                {isLoading ? (
                    <span className="blinking-cursor">Generating idea...</span>
                ) : (
                    <p className="text-flicker-effect">{tip}</p>
                )}
            </div>

            <button
                onClick={onGenerateTip}
                disabled={isLoading}
                className="w-full px-8 py-3 bg-cyan-600 text-white font-bold rounded-md uppercase tracking-widest hover:bg-cyan-500 transition-all duration-200 transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed glow-cyan"
            >
                {isLoading ? 'Thinking...' : 'Get Tip'}
            </button>
        </div>
    );
};

export default SoundDesignAssistant;
