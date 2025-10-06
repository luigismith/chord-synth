import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, options, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-4 items-center">
        <span className="font-bold text-cyan-300 w-16">{label}:</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left bg-gray-800 border-2 border-cyan-500 neon-border-cyan text-cyan-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200"
        >
            <div className="flex justify-between items-center">
                <span>{value}</span>
                <svg className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full right-0 bg-gray-900 border-2 border-cyan-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              className="px-4 py-2 text-cyan-200 hover:bg-cyan-700 hover:text-white cursor-pointer transition-colors duration-150"
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
