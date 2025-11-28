
import React from 'react';
import { CORRECT_KEYBOARD_ROWS } from '../constants';

interface VirtualKeyboardProps {
  activeKey: string | null; // The key code that the user needs to press next
  pressedKey: string | null; // The key the user just pressed (for visual feedback)
  showHints: boolean; // Whether to highlight the active key
  onKeyPress: (key: string) => void; // New prop to handle clicks
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ activeKey, pressedKey, showHints, onKeyPress }) => {
  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-800 rounded-xl shadow-2xl max-w-4xl mx-auto mt-8 select-none">
      {CORRECT_KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
          {row.map((keyConfig) => {
            const isTarget = showHints && activeKey === keyConfig.code;
            const isPressed = pressedKey === keyConfig.code;
            const isSpace = keyConfig.code === ' ';
            
            let bgClass = "bg-gray-700 border-gray-600";
            if (isTarget) bgClass = "bg-blue-500 border-blue-400 ring-2 ring-blue-300 animate-pulse";
            if (isPressed) {
                // If pressed and was target -> Green, else Red
                bgClass = (activeKey === keyConfig.code) 
                    ? "bg-green-500 border-green-400" 
                    : "bg-red-500 border-red-400";
            }

            return (
              <div
                key={keyConfig.code}
                onClick={() => onKeyPress(keyConfig.code)}
                className={`
                  relative flex flex-col items-center justify-center 
                  border-b-4 rounded-lg transition-all duration-100 cursor-pointer
                  active:scale-95 active:border-b-0 active:translate-y-1 hover:brightness-110
                  ${bgClass}
                  ${isSpace ? 'w-48 sm:w-64 md:w-80 h-10 sm:h-14 md:h-16' : 'w-8 h-10 sm:w-12 sm:h-14 md:w-14 md:h-16'}
                `}
              >
                {/* Zhuyin Main Label */}
                <span className={`text-sm sm:text-lg md:text-xl font-bold ${isTarget ? 'text-white' : 'text-gray-100'}`}>
                  {keyConfig.label}
                </span>
                
                {/* English Key Sub-label */}
                <span className={`absolute top-0.5 right-1 text-[8px] sm:text-[10px] font-mono ${isTarget ? 'text-blue-100' : 'text-gray-400'}`}>
                  {keyConfig.subLabel === 'Space' ? 'SPACE' : keyConfig.subLabel.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
