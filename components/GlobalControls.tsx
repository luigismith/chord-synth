
import React, { useState, useEffect } from 'react';
import { PlayIcon, StopIcon, RecordIcon } from './icons';

interface GlobalControlsProps {
    arpIsActive: boolean;
    isRecording: boolean;
    activeTransport: string | null;
    handlePlay: () => void;
    handleStop: () => void;
    handleRecord: () => void;
    midiDevices: string[];
    onConnectMidi: () => void;
    isMidiClockSynced: boolean;
    externalBpm: number | null;
    lastBeatTimestamp: number;
    lastOffBeatTimestamp: number;
    swingAmount: number;
}

const GlobalControls: React.FC<GlobalControlsProps> = ({
    arpIsActive,
    isRecording,
    activeTransport,
    handlePlay,
    handleStop,
    handleRecord,
    midiDevices,
    onConnectMidi,
    isMidiClockSynced,
    externalBpm,
    lastBeatTimestamp,
    lastOffBeatTimestamp,
    swingAmount,
}) => {
    const [isBeating, setIsBeating] = useState(false);
    const [isSwinging, setIsSwinging] = useState(false);

    useEffect(() => {
        // A timestamp of 0 means no beat yet, so we don't flash.
        if (lastBeatTimestamp > 0) {
            setIsBeating(true);
            const timer = setTimeout(() => setIsBeating(false), 100); // Flash for 100ms
            return () => clearTimeout(timer);
        }
    }, [lastBeatTimestamp]);
    
    useEffect(() => {
        // A timestamp of 0 means no off-beat yet, so we don't flash.
        if (lastOffBeatTimestamp > 0) {
            setIsSwinging(true);
            const timer = setTimeout(() => setIsSwinging(false), 80); // A slightly shorter pulse for the off-beat
            return () => clearTimeout(timer);
        }
    }, [lastOffBeatTimestamp]);

    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className={`flex items-center space-x-2 p-1 bg-black/20 rounded-lg border border-white/10 ${isMidiClockSynced ? 'opacity-50 pointer-events-none' : ''}`}>
                <button 
                    onClick={handlePlay} 
                    className={`p-2 rounded-md transition-colors ${arpIsActive ? 'text-cyan-400 bg-cyan-900/50' : 'text-gray-400 hover:bg-gray-700'} ${activeTransport === 'play' ? 'bg-gray-600' : ''}`}
                    title="Play Arpeggiator"
                    disabled={isMidiClockSynced}
                >
                    <PlayIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={handleStop} 
                    className={`p-2 rounded-md transition-colors ${activeTransport === 'stop' ? 'text-white bg-gray-600' : 'text-gray-400 hover:bg-gray-700'}`}
                    title="Stop Arpeggiator"
                    disabled={isMidiClockSynced}
                >
                    <StopIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={handleRecord} 
                    className={`p-2 rounded-md transition-colors ${isRecording ? 'text-red-400 bg-red-900/50 animate-pulse' : 'text-gray-400 hover:bg-gray-700'}`}
                    title="Record (Arm)"
                >
                    <RecordIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
                {isMidiClockSynced ? (
                    <div className={`transition-all duration-100 flex items-center space-x-2 p-2 bg-green-900/50 rounded-lg h-[42px] border ${isBeating ? 'border-green-300 shadow-lg shadow-green-400/50' : 'border-green-500'}`}>
                        {/* Beat and Swing Visualizer */}
                        <div className="flex items-center space-x-1.5" title={`Swing: ${swingAmount}%`}>
                           {/* Main beat dot */}
                            <div className={`w-3 h-3 rounded-full transition-all duration-100 ${isBeating ? 'bg-green-300 scale-150 shadow-lg shadow-green-300/50' : 'bg-green-800 scale-100'}`}></div>
                            
                            {/* Swing stutter dot - appears only when swing is active and pulses on the actual off-beat tick */}
                            {swingAmount > 0 && (
                                <div 
                                    className={`w-2 h-2 rounded-full transition-all duration-100 ${isSwinging ? 'bg-green-400 scale-125' : 'bg-green-800 scale-100'}`}
                                ></div>
                            )}
                        </div>
                        <span className="text-sm font-bold text-green-300">
                            MIDI SYNC: {externalBpm ? `${externalBpm} BPM` : '...'}
                        </span>
                    </div>
                ) : (
                    <button 
                        onClick={onConnectMidi} 
                        className={`px-4 py-2 bg-cyan-600 text-white font-bold rounded-md uppercase text-sm tracking-widest hover:bg-cyan-500 transition-colors glow-cyan ${midiDevices.length === 0 ? 'pulse-glow-cyan' : ''}`}
                    >
                        Connect MIDI
                    </button>
                )}
                <div className="text-xs text-gray-400 mt-2 truncate max-w-[200px]">
                    {midiDevices.length > 0 ? `Connected: ${midiDevices.join(', ')}` : 'No MIDI device connected.'}
                </div>
            </div>
        </div>
    );
};

export default GlobalControls;
