import React from 'react';
import { KnobState } from '../types';
import Knob from './Knob';

interface ControlPanelProps {
  knobs: KnobState[];
  onKnobChange: (id: number, value: number) => void;
  arpIsActive: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ knobs, onKnobChange, arpIsActive }) => {
  const isArpKnob = (id: number) => id === 2 || id === 3;

  return (
    <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6">
        {knobs.map((knob) => (
          <div 
            key={knob.id}
            className={`transition-opacity duration-300 ${!arpIsActive && isArpKnob(knob.id) ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
          >
            <Knob knob={knob} onValueChange={onKnobChange} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ControlPanel;
