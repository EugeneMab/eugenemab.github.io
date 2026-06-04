import { html, React, LucideReact } from '../utils/html.js';

const { useState, useRef, useEffect } = React;
const RATIO = 1.05;

const valueToLog = (val) => Math.log(val) / Math.log(RATIO);
const logToValue = (log) => Math.pow(RATIO, log);

export const PopupSlider = ({ icon, value, onChange, min, max, title }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const logMin = Math.floor(valueToLog(min));
  const logMax = Math.ceil(valueToLog(max));
  const logValue = valueToLog(value);

  const IconComponent = {
    'zoom-in': LucideReact.ZoomIn,
    'type': LucideReact.Type
  }[icon] || LucideReact.Settings;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return html`
    <div className="relative" ref=${containerRef}>
      <button
        title=${title}
        onClick=${() => setIsOpen(!isOpen)}
        className=${`p-2 rounded hover:bg-gray-100 transition-colors flex items-center justify-center ${isOpen ? 'bg-gray-100 text-blue-600' : 'text-gray-500'}`}
      >
        <${IconComponent} size=${18} />
      </button>

      ${isOpen && html`
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 flex flex-col items-center gap-2">
          <div className="h-48 flex items-center px-2">
            <input
              type="range"
              min=${logMin}
              max=${logMax}
              step="1"
              value=${Math.round(logValue)}
              onChange=${(e) => {
                const next = logToValue(parseInt(e.target.value, 10));
                return onChange(Math.min(max, Math.max(min, next)));
              }}
              style=${{
                WebkitAppearance: 'slider-vertical',
                writingMode: 'bt-lr',
                width: '12px',
                height: '100%',
              }}
              className="cursor-pointer"
            />
          </div>
          <div className="text-[10px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 min-w-[32px] text-center">
            ${value.toFixed(2)}x
          </div>
        </div>
      `}
    </div>
  `;
};
