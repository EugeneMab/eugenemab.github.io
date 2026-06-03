import React, { useState, useMemo } from 'react';
import { useStore, ActiveMode } from '../store/useStore';
import { Undo, ZoomIn, Type, Eraser, FolderOpen, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import {
  TEAM_COLORS,
  TITLE_HEIGHT,
  PADDING,
  IMG_HEIGHT,
  ROW_GAP,
  getFilteredPeople,
} from '../utils/layout';
import OpenFolderModal from './OpenFolderModal';
import PopupSlider from './PopupSlider';

const MAX_IMAGE_HEIGHT = 10240;

const ICON_SIZE_18 = 18;
const ICON_SIZE_20 = 20;
const ICON_SIZE_24 = 24;
const RANGE_STEP = 0.02;
const BODY_SCALE_MIN = 0.02;
const BODY_SCALE_MAX = 1.25;
const DESC_SCALE_MIN = 0.25;
const DESC_SCALE_MAX = 4;

const TopButtonPane: React.FC = () => {
  const {
    activeMode,
    setActiveMode,
    data,
    setBodyScale,
    setDescriptionScale,
    undo,
    selectedEpisodeId,
    currentFolderPath,
  } = useStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const { bodyScale = 1, descriptionScale = 1 } = data;

  const totalHeight = useMemo(() => {
    if (selectedEpisodeId === null) {
      return 0;
    }
    const episodeIndex =
      data.episodes.findIndex((ep) => {
        return ep.id === selectedEpisodeId;
      }) + 1;
    const filteredPeople = getFilteredPeople(data, episodeIndex);
    const males = filteredPeople.filter((p) => {
      return p.gender === 'male';
    });
    const females = filteredPeople.filter((p) => {
      return p.gender === 'female';
    });
    const numRows = Math.max(males.length, females.length);
    return TITLE_HEIGHT + PADDING + numRows * (IMG_HEIGHT + ROW_GAP);
  }, [data, selectedEpisodeId]);

  const showWarning = totalHeight > MAX_IMAGE_HEIGHT;

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
            onClick={() => {
              return setActiveMode(activeMode === 'message' ? 'select' : 'message');
            }}
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
            onClick={() => {
              return setActiveMode(activeMode === 'weak-message' ? 'select' : 'weak-message');
            }}
          >
            <div className="w-1/2 h-full bg-blue-300" />
            <div className="w-1/2 h-full bg-red-300" />
          </button>

          <button
            title="Send Message (Bidirectional)"
            className={clsx(
              'w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-opacity',
              activeMode === 'bidirectional-message' ? 'border-black scale-110' : 'border-gray-300'
            )}
            onClick={() => {
              return setActiveMode(
                activeMode === 'bidirectional-message' ? 'select' : 'bidirectional-message'
              );
            }}
          >
            <div className="w-full h-full bg-[#8B008B]" />
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
                  onClick={() => {
                    return setActiveMode(activeMode === mode ? 'select' : mode);
                  }}
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
            onClick={() => {
              return setActiveMode(activeMode === 'eraser' ? 'select' : 'eraser');
            }}
          >
            <Eraser
              size={ICON_SIZE_24}
              className={clsx(activeMode === 'eraser' ? 'text-red-600' : 'text-gray-500')}
            />
          </button>
        </>
      )}

      {showWarning && (
        <div
          className="flex items-center gap-1 text-red-600 animate-pulse"
          title={`Exported image height exceeds ${MAX_IMAGE_HEIGHT}px!`}
        >
          <AlertCircle size={ICON_SIZE_20} />
          <span className="text-xs font-bold whitespace-nowrap">Too Tall!</span>
        </div>
      )}

      {currentFolderPath && (
        <>
          <div
            title={currentFolderPath === '.' ? '/' : currentFolderPath}
            className="flex-1 px-3 py-1 bg-gray-50 rounded-md text-xs font-mono text-gray-400 truncate border border-gray-100 shadow-inner"
          >
            {currentFolderPath === '.' ? '/' : currentFolderPath}
          </div>

          {/* Global Scaling Sliders */}
          <div className="flex items-center gap-2 shrink-0">
            <PopupSlider
              Icon={ZoomIn}
              value={bodyScale}
              onChange={setBodyScale}
              min={BODY_SCALE_MIN}
              max={BODY_SCALE_MAX}
              title="Body Scale"
            />
            <PopupSlider
              Icon={Type}
              value={descriptionScale}
              onChange={setDescriptionScale}
              min={DESC_SCALE_MIN}
              max={DESC_SCALE_MAX}
              title="Description Scale"
            />
          </div>

          {/* Undo Last Action */}
          <button
            title="Undo"
            className="p-2 hover:bg-gray-100 rounded text-gray-700"
            onClick={() => {
              return undo();
            }}
          >
            <Undo size={ICON_SIZE_24} />
          </button>
        </>
      )}

      {!currentFolderPath && <div className="flex-1" />}

      {/* Open Button */}
      <button
        title="Open Folder"
        className="p-2 hover:bg-gray-100 rounded text-blue-600 transition-colors"
        onClick={() => {
          return setIsModalOpen(true);
        }}
      >
        <FolderOpen size={ICON_SIZE_24} />
      </button>

      {isModalOpen && (
        <OpenFolderModal
          onClose={() => {
            return setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default TopButtonPane;
