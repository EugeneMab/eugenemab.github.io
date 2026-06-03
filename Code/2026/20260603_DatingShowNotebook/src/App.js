import { html, React, LucideReact } from './utils/html.js';
import { TopButtonPane } from './components/TopButtonPane.js';
import { AppContent } from './components/AppContent.js';

const { useState, useEffect } = React;

export const App = () => {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('dsn_data');
    return saved ? JSON.parse(saved) : {
      people: [],
      episodes: [],
      nextUniqueId: 1,
      bodyScale: 1,
      descriptionScale: 1
    };
  });

  const [activeMode, setActiveMode] = useState('message');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('dsn_data', JSON.stringify(data));
  }, [data]);

  const updateData = (updater) => {
    setData(prev => {
      const newData = typeof updater === 'function' ? updater(prev) : updater;
      setUndoStack(s => [JSON.parse(JSON.stringify(prev)), ...s].slice(0, 50));
      return newData;
    });
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const [prev, ...rest] = undoStack;
    setData(prev);
    setUndoStack(rest);
  };

  const downloadData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dating-show-notebook.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return html`
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden font-sans">
      <${TopButtonPane} 
        activeMode=${activeMode} 
        setActiveMode=${setActiveMode}
        data=${data}
        setData=${updateData}
        undo=${undo}
        selectedEpisodeId=${selectedEpisodeId}
        onOpenDataModal=${() => setIsDataModalOpen(true)}
        onDownloadData=${downloadData}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-inner">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-gray-700">Episodes</h2>
            <button 
              onClick=${() => updateData(prev => ({
                ...prev,
                episodes: [...prev.episodes, {
                  id: prev.nextUniqueId,
                  title: 'New Episode',
                  events: []
                }],
                nextUniqueId: prev.nextUniqueId + 1
              }))}
              className="p-1 hover:bg-gray-200 rounded text-blue-600"
              title="Add Episode"
            >
              <${LucideReact.PlusCircle} size=${20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div 
              className=${`p-2 rounded cursor-pointer flex items-center gap-2 ${selectedEpisodeId === null ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}
              onClick=${() => {
                setSelectedEpisodeId(null);
                setSelectedEventId(null);
              }}
            >
              <${LucideReact.Users} size=${18} />
              <span>Participants</span>
            </div>
            <div className="h-px bg-gray-100 my-2" />
            ${data.episodes.map(ep => html`
              <div key=${ep.id} className="space-y-1">
                <div 
                  className=${`p-2 rounded cursor-pointer flex justify-between items-center group ${selectedEpisodeId === ep.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                  onClick=${() => {
                    setSelectedEpisodeId(ep.id);
                    if (ep.events.length > 0) setSelectedEventId(ep.events[0].id);
                    else setSelectedEventId(null);
                  }}
                >
                  <span className="truncate flex-1">${ep.title}</span>
                  <button 
                    onClick=${(e) => {
                      e.stopPropagation();
                      updateData(prev => ({
                        ...prev,
                        episodes: prev.episodes.map(x => x.id === ep.id ? {
                          ...x,
                          events: [...x.events, {
                            id: prev.nextUniqueId,
                            title: 'New Event',
                            messages: [],
                            teams: {}
                          }]
                        } : x),
                        nextUniqueId: prev.nextUniqueId + 1
                      }));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-green-600"
                    title="Add Event"
                  >
                    <${LucideReact.Plus} size=${16} />
                  </button>
                </div>
                ${selectedEpisodeId === ep.id && ep.events.map(ev => html`
                  <div 
                    key=${ev.id}
                    className=${`ml-4 p-2 text-sm rounded cursor-pointer ${selectedEventId === ev.id ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100'}`}
                    onClick=${() => setSelectedEventId(ev.id)}
                  >
                    ${ev.title}
                  </div>
                `)}
              </div>
            `)}
          </div>
        </div>

        <${AppContent} 
          data=${data}
          setData=${updateData}
          activeMode=${activeMode}
          selectedEpisodeId=${selectedEpisodeId}
          selectedEventId=${selectedEventId}
        />
      </div>

      ${isDataModalOpen && html`
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Import / Export Data</h2>
              <button onClick=${() => setIsDataModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <${LucideReact.X} size=${24} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
              <p className="text-sm text-gray-500">Paste your JSON data here to load it, or copy the current data for backup.</p>
              <textarea 
                id="data-textarea"
                className="flex-1 p-4 font-mono text-xs border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                defaultValue=${JSON.stringify(data, null, 2)}
              ></textarea>
              <div className="flex justify-end gap-3">
                <button 
                  onClick=${() => setIsDataModalOpen(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick=${() => {
                    try {
                      const val = document.getElementById('data-textarea').value;
                      const parsed = JSON.parse(val);
                      setData(parsed);
                      setIsDataModalOpen(false);
                    } catch (e) {
                      alert('Invalid JSON: ' + e.message);
                    }
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  Save & Load
                </button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
};
