import React from 'react';
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
}) => {
    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2 p-1 bg-black/20 rounded-lg border border-white/10">
                <button 
                    onClick={handlePlay} 
                    className={`p-2 rounded-md transition-colors ${arpIsActive ? 'text-cyan-400 bg-cyan-900/50' : 'text-gray-400 hover:bg-gray-700'} ${activeTransport === 'play' ? 'bg-gray-600' : ''}`}
                    title="Play Arpeggiator"
                >
                    <PlayIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={handleStop} 
                    className={`p-2 rounded-md transition-colors ${activeTransport === 'stop' ? 'text-white bg-gray-600' : 'text-gray-400 hover:bg-gray-700'}`}
                    title="Stop Arpeggiator"
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
                <button 
                    onClick={onConnectMidi} 
                    className={`px-4 py-2 bg-cyan-600 text-white font-bold rounded-md uppercase text-sm tracking-widest hover:bg-cyan-500 transition-colors glow-cyan ${midiDevices.length === 0 ? 'pulse-glow-cyan' : ''}`}
                >
                    Connect MIDI
                </button>
                <div className="text-xs text-gray-400 mt-2 truncate max-w-[200px]">
                    {midiDevices.length > 0 ? `Connected: ${midiDevices.join(', ')}` : 'No MIDI device connected.'}
                </div>
            </div>
        </div>
    );
};

export default GlobalControls;
