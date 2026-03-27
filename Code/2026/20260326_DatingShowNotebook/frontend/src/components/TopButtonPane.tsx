import React from 'react';
import { useStore, ActiveMode } from '../store/useStore';
import { Undo, ZoomIn, Type } from 'lucide-react';
import { clsx } from 'clsx';

const TopButtonPane: React.FC = () => {
  const { 
    activeMode, setActiveMode, 
    bodyScale, setBodyScale, 
    descriptionScale, setDescriptionScale, 
    undo, selectedEpisodeId 
  } = useStore();

  const teamColors = ['#f97316', '#06b6d4', '#a855f7', '#84cc16', '#eab308']; // Orange, Cyan, Purple, LimeGreen, Gold

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shadow-sm z-10">
      {selectedEpisodeId !== null && (
        <>
          {/* Message Buttons */}
          <button
            title="Send Message"
            className={clsx(
              "w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-opacity",
              activeMode === 'message' ? "border-black scale-110" : "border-gray-300"
            )}
            onClick={() => setActiveMode(activeMode === 'message' ? 'select' : 'message')}
          >
            <div className="w-1/2 h-full bg-blue-600" />
            <div className="w-1/2 h-full bg-red-600" />
          </button>

          <button
            title="Send Weak Message"
            className={clsx(
              "w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-opacity",
              activeMode === 'weak-message' ? "border-black scale-110" : "border-gray-300"
            )}
            onClick={() => setActiveMode(activeMode === 'weak-message' ? 'select' : 'weak-message')}
          >
            <div className="w-1/2 h-full bg-blue-300" />
            <div className="w-1/2 h-full bg-red-300" />
          </button>

          <div className="h-8 w-px bg-gray-300 mx-2" />

          {/* Team Buttons */}
          <div className="flex gap-2">
            {teamColors.map((color, idx) => {
              const mode = `team-${idx}` as ActiveMode;
              return (
                <button
                  key={idx}
                  title={`Team ${idx + 1}`}
                  className={clsx(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                    activeMode === mode ? "border-black scale-125" : "border-gray-200"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setActiveMode(activeMode === mode ? 'select' : mode)}
                />
              );
            })}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Sliders */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <ZoomIn size={16} className="text-gray-500" />
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={bodyScale}
            onChange={(e) => setBodyScale(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex flex-col items-center">
          <Type size={16} className="text-gray-500" />
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={descriptionScale}
            onChange={(e) => setDescriptionScale(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Undo */}
      <button
        title="Undo"
        className="p-2 hover:bg-gray-100 rounded text-gray-700"
        onClick={undo}
      >
        <Undo size={24} />
      </button>
    </div>
  );
};

export default TopButtonPane;
