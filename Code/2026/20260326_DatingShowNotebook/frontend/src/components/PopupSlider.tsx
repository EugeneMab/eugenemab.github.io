import React, { useState, useRef, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface PopupSliderProps {
  Icon: LucideIcon;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  title: string;
  position?: 'down' | 'right-up';
}

const RATIO = 1.05;

const valueToLog = (val: number) => Math.log(val) / Math.log(RATIO);
const logToValue = (log: number) => Math.pow(RATIO, log);

const PopupSlider: React.FC<PopupSliderProps> = ({
  Icon,
  value,
  onChange,
  min,
  max,
  title,
  position = 'down',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const logMin = Math.floor(valueToLog(min));
  const logMax = Math.ceil(valueToLog(max));
  const logValue = valueToLog(value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        title={title}
        onClick={() => {
          return setIsOpen(!isOpen);
        }}
        className={clsx(
          'p-2 rounded hover:bg-gray-100 transition-colors flex items-center justify-center',
          isOpen ? 'bg-gray-100 text-blue-600' : 'text-gray-500'
        )}
      >
        <Icon size={18} />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 flex flex-col items-center gap-2 absolute',
            position === 'right-up' ? 'left-full bottom-0 ml-2' : 'right-0 top-full mt-2'
          )}
        >
          <div className="h-48 flex items-center px-2">
            <input
              type="range"
              min={logMin}
              max={logMax}
              step={1}
              value={Math.round(logValue)}
              onChange={(e) => {
                const next = logToValue(parseInt(e.target.value, 10));
                return onChange(Math.min(max, Math.max(min, next)));
              }}
              style={
                {
                  WebkitAppearance: 'slider-vertical',
                  writingMode: 'bt-lr',
                  width: '12px',
                  height: '100%',
                } as unknown as React.CSSProperties
              }
              className="cursor-pointer"
            />
          </div>
          <div className="text-[10px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 min-w-[32px] text-center">
            {value.toFixed(2)}x
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupSlider;
