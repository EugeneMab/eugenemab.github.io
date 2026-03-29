import React from 'react';
import { useStore, ActiveMode } from '../store/useStore';
import { Undo, ZoomIn, Type, Eraser } from 'lucide-react';
import { clsx } from 'clsx';
import { TEAM_COLORS } from '../utils/layout';

const TopButtonPane: React.FC = () => {
  const {
    activeMode,
    setActiveMode,
    data,
    setBodyScale,
    setDescriptionScale,
    undo,
    selectedEpisodeId,
  } = useStore();

  const { bodyScale = 1, descriptionScale = 1 } = data;

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shadow-sm z-10">
      {selectedEpisodeId !== null && (
        <>
          {/* Relationship Buttons: Strong and Weak messages between persons */}
          <button
            title="Send Message (Strong)"
            className={clsx(
              'w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-opacity',
              activeMode === 'message' ? 'border-black scale-110' : 'border-gray-300'
            )}
            onClick={() => setActiveMode(activeMode === 'message' ? 'select' : 'message')}
          >
            <div className="w-1/2 h-full bg-blue-600" />
            <div className="w-1/2 h-full bg-red-600" />
          </button>

          <button
            title="Send Message (Weak)"
            className={clsx(
              'w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-opacity',
              activeMode === 'weak-message' ? 'border-black scale-110' : 'border-gray-300'
            )}
            onClick={() => setActiveMode(activeMode === 'weak-message' ? 'select' : 'weak-message')}
          >
            <div className="w-1/2 h-full bg-blue-300" />
            <div className="w-1/2 h-full bg-red-300" />
          </button>

          <div className="h-8 w-px bg-gray-300 mx-2" />

          {/* Team Assignment Buttons: Assign persons to colored teams */}
          <div className="flex gap-1">
            {TEAM_COLORS.map((color, idx) => {
              const mode = `team-${idx}` as ActiveMode;
              return (
                <button
                  key={idx}
                  title={`Team ${idx + 1}`}
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
                    activeMode === mode ? 'border-black scale-125' : 'border-gray-200'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setActiveMode(activeMode === mode ? 'select' : mode)}
                />
              );
            })}
          </div>

          <div className="h-8 w-px bg-gray-300 mx-2" />

          {/* Eraser Button: Remove messages or team memberships by clicking on persons */}
          <button
            title="Eraser Mode"
            className={clsx(
              'w-10 h-10 border-2 rounded flex items-center justify-center hover:opacity-80 transition-opacity',
              activeMode === 'eraser' ? 'border-black scale-110 bg-gray-200' : 'border-gray-300'
            )}
            onClick={() => setActiveMode(activeMode === 'eraser' ? 'select' : 'eraser')}
          >
            <Eraser
              size={24}
              className={clsx(activeMode === 'eraser' ? 'text-red-600' : 'text-gray-500')}
            />
          </button>
        </>
      )}

      <div className="flex-1" />

      {/* Global Scaling Sliders */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <ZoomIn size={18} className="text-gray-500 shrink-0" />
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.02"
            value={bodyScale}
            onChange={(e) => setBodyScale(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2">
          <Type size={18} className="text-gray-500 shrink-0" />
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.02"
            value={descriptionScale}
            onChange={(e) => setDescriptionScale(parseFloat(e.target.value))}
            className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Undo Last Action */}
      <button title="Undo" className="p-2 hover:bg-gray-100 rounded text-gray-700" onClick={undo}>
        <Undo size={24} />
      </button>
    </div>
  );
};

export default TopButtonPane;
