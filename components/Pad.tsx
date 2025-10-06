import React from 'react';
import { PadState } from '../types';

interface PadProps {
    pad: PadState;
    onPress: (pad: PadState) => void;
    onRelease: (pad: PadState) => void;
    isActive: boolean;
    isArmed: boolean;
}

const Pad: React.FC<PadProps> = ({ pad, onPress, onRelease, isActive, isArmed }) => {
    const baseClasses = "h-20 w-20 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-100 transform focus:outline-none";
    const colorClasses = pad.type === 'chord' ? 'bg-pink-800 border-pink-500 neon-border-pink text-pink-100' : 'bg-cyan-800 border-cyan-500 neon-border-cyan text-cyan-100';
    
    // Active class for momentary press
    const activeClasses = isActive ? (pad.type === 'chord' ? 'bg-pink-500 scale-105 shadow-lg shadow-pink-500/50' : 'bg-cyan-500 scale-105 shadow-lg shadow-cyan-500/50') : 'hover:scale-105';

    // Armed class for persistent selection (like an active ARP pattern)
    const armedClasses = isArmed ? 'pulse-glow-cyan' : '';

    return (
        <div 
            className={`${baseClasses} ${colorClasses} ${activeClasses} ${armedClasses} border-2`}
            onMouseDown={() => onPress(pad)}
            onMouseUp={() => onRelease(pad)}
            onMouseLeave={() => onRelease(pad)}
        >
            <span className="text-sm font-bold uppercase">{pad.label}</span>
            <span className="text-xs opacity-80">{pad.type}</span>
        </div>
    );
};

export default Pad;