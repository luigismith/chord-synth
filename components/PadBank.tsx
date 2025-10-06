import React from 'react';
import { PadState, Chord } from '../types';
import { PADS } from '../constants';
import Pad from './Pad';

interface PadBankProps {
    onPadPress: (pad: PadState) => void;
    onPadRelease: (pad: PadState) => void;
    activePads: number[];
    armedPadValue: string | null;
    chords: Chord[];
}

const PadBank: React.FC<PadBankProps> = ({ onPadPress, onPadRelease, activePads, armedPadValue, chords }) => {
    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4">
            <div className="grid grid-cols-4 gap-4">
                {PADS.map(pad => {
                    // Override label for chord pads with AI-generated chord names
                    const displayPad = { ...pad };
                    if (pad.type === 'chord' && chords[pad.id - 1]) {
                        displayPad.label = chords[pad.id - 1].name;
                    }

                    return (
                        <Pad 
                            key={pad.id} 
                            pad={displayPad} 
                            onPress={onPadPress}
                            onRelease={onPadRelease}
                            isActive={activePads.includes(pad.id)}
                            isArmed={pad.type === 'arp' && pad.value === armedPadValue}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default PadBank;