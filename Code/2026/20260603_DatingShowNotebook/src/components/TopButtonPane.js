import { html, LucideReact } from '../utils/html.js';
import { TEAM_COLORS } from '../utils/layout.js';
import { PopupSlider } from './PopupSlider.js';

export const TopButtonPane = ({ 
  activeMode, 
  setActiveMode, 
  data, 
  setData, 
  undo, 
  selectedEpisodeId,
  onOpenDataModal,
  onDownloadData
}) => {
  const { bodyScale = 1, descriptionScale = 1 } = data;

  const setBodyScale = (val) => setData(prev => ({ ...prev, bodyScale: val }));
  const setDescriptionScale = (val) => setData(prev => ({ ...prev, descriptionScale: val }));

  return html`
    <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shadow-sm z-10">
      <button 
        className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded transition-colors group"
        onClick=${onDownloadData}
        title="Download Data as JSON"
      >
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-md group-hover:bg-blue-700">
          <${LucideReact.Book} size=${20} />
        </div>
        <span className="font-bold text-gray-800 hidden sm:inline">Dating Show Notebook</span>
      </button>

      <div className="h-8 w-px bg-gray-300 mx-2" />

      ${selectedEpisodeId !== null && html`
        <div className="flex items-center gap-2">
          <button
            title="Send Message (Strong)"
            className=${`w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-all ${activeMode === 'message' ? 'border-black scale-110 shadow-md' : 'border-gray-300'}`}
            onClick=${() => setActiveMode(activeMode === 'message' ? 'select' : 'message')}
          >
            <div className="w-1/2 h-full bg-blue-600" />
            <div className="w-1/2 h-full bg-red-600" />
          </button>

          <button
            title="Send Message (Weak)"
            className=${`w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-all ${activeMode === 'weak-message' ? 'border-black scale-110 shadow-md' : 'border-gray-300'}`}
            onClick=${() => setActiveMode(activeMode === 'weak-message' ? 'select' : 'weak-message')}
          >
            <div className="w-1/2 h-full bg-blue-300" />
            <div className="w-1/2 h-full bg-red-300" />
          </button>

          <button
            title="Send Message (Bidirectional)"
            className=${`w-10 h-10 border-2 rounded flex overflow-hidden hover:opacity-80 transition-all ${activeMode === 'bidirectional-message' ? 'border-black scale-110 shadow-md' : 'border-gray-300'}`}
            onClick=${() => setActiveMode(activeMode === 'bidirectional-message' ? 'select' : 'bidirectional-message')}
          >
            <div className="w-full h-full bg-[#8B008B]" />
          </button>

          <div className="h-8 w-px bg-gray-200 mx-1" />

          <div className="flex gap-1">
            ${TEAM_COLORS.map((color, idx) => {
              const mode = `team-${idx}`;
              return html`
                <button
                  key=${idx}
                  title=${`Team ${idx + 1}`}
                  className=${`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${activeMode === mode ? 'border-black scale-125 shadow-md' : 'border-gray-200'}`}
                  style=${{ backgroundColor: color }}
                  onClick=${() => setActiveMode(activeMode === mode ? 'select' : mode)}
                />
              `;
            })}
          </div>

          <div className="h-8 w-px bg-gray-200 mx-1" />

          <button
            title="Eraser Mode"
            className=${`w-10 h-10 border-2 rounded flex items-center justify-center hover:opacity-80 transition-all ${activeMode === 'eraser' ? 'border-black scale-110 bg-gray-100 shadow-md' : 'border-gray-300'}`}
            onClick=${() => setActiveMode(activeMode === 'eraser' ? 'select' : 'eraser')}
          >
            <${LucideReact.Eraser} size=${24} className=${activeMode === 'eraser' ? 'text-red-600' : 'text-gray-500'} />
          </button>
        </div>
      `}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <${PopupSlider}
          icon="zoom-in"
          value=${bodyScale}
          onChange=${setBodyScale}
          min=${0.25}
          max=${2.5}
          title="Body Scale"
        />
        <${PopupSlider}
          icon="type"
          value=${descriptionScale}
          onChange=${setDescriptionScale}
          min=${0.25}
          max=${2.5}
          title="Description Scale"
        />

        <button
          title="Undo"
          className="p-2 hover:bg-gray-100 rounded text-gray-700 transition-colors"
          onClick=${undo}
        >
          <${LucideReact.Undo} size=${24} />
        </button>

        <button
          title="Import / Export Folder Data"
          className="p-2 hover:bg-gray-100 rounded text-blue-600 transition-colors"
          onClick=${onOpenDataModal}
        >
          <${LucideReact.FolderOpen} size=${24} />
        </button>
      </div>
    </div>
  `;
};
