import React from 'react';
import { KnobState } from '../types';
import Knob from './Knob';

interface EnvelopePanelProps {
  knobs: KnobState[];
  onKnobChange: (id: number, value: number) => void;
}

const EnvelopePanel: React.FC<EnvelopePanelProps> = ({ knobs, onKnobChange }) => {
  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4">
      <h3 className="text-xl uppercase tracking-widest text-pink-400 neon-text-pink font-['Russo_One'] mb-4 text-center">
        AMP ENVELOPE
      </h3>
      <div className="grid grid-cols-4 gap-x-2 gap-y-6">
        {knobs.map((knob) => (
          <div 
            key={knob.id}
            className="flex justify-center"
          >
            <Knob knob={knob} onValueChange={onKnobChange} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnvelopePanel;