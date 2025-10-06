import React from 'react';
import { KnobState } from '../types';

// Helper functions to draw the SVG arc
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
  return d;
};


const Knob: React.FC<{ knob: KnobState; onValueChange: (id: number, value: number) => void; }> = ({ knob, onValueChange }) => {
  const angleRange = 270; // -135 to +135 degrees
  const startAngle = -135;
  const endAngle = startAngle + (knob.value / 100) * angleRange;
  
  const arcPath = describeArc(50, 50, 40, startAngle, endAngle);
  const fullArcPath = describeArc(50, 50, 40, startAngle, 135);

  return (
    <div className="flex flex-col items-center justify-start space-y-2 w-24 h-32 text-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
                <filter id="glow-cyan-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            {/* Base Track */}
            <path d={fullArcPath} fill="none" stroke="rgba(6, 182, 212, 0.2)" strokeWidth="10"/>
            {/* Value Arc */}
            <path d={arcPath} fill="none" stroke="#06b6d4" strokeWidth="10" strokeLinecap="round" style={{ filter: 'url(#glow-cyan-filter)' }}/>
            <text x="50" y="60" fontFamily="Orbitron, sans-serif" fontSize="20" fill="#e0e0e0" textAnchor="middle" className="glow-cyan">
                {knob.value}
            </text>
        </svg>
      </div>
       <label className="text-xs uppercase tracking-widest text-cyan-200 h-8 flex items-center">{knob.label}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={knob.value}
        onChange={(e) => onValueChange(knob.id, parseInt(e.target.value, 10))}
        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm dark:bg-gray-700"
      />
    </div>
  );
};

export default Knob;