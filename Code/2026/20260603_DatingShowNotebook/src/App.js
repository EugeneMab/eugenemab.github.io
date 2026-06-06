import { html, React, LucideReact } from './utils/html.js';
import { TopButtonPane } from './components/TopButtonPane.js';
import { AppContent } from './components/AppContent.js';

const { useState, useEffect } = React;

const DEFAULT_DATA = {
  people: [],
  episodes: [],
  nextUniqueId: 1,
  bodyScale: 1,
  descriptionScale: 1
};

export const App = () => {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('dsn_data');
    if (!saved) return DEFAULT_DATA;
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved data, falling back to default.');
      return DEFAULT_DATA;
    }
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
              onClick=${() => updateData(prev => {
                const epId = prev.nextUniqueId;
                const evId = epId + 1;
                const title = `Episode ${prev.episodes.length + 1}`;
                return {
                  ...prev,
                  episodes: [...prev.episodes, {
                    id: epId,
                    title: title,
                    events: [{
                      id: evId,
                      title: `${title}-1`,
                      messages: [],
                      teams: {}
                    }]
                  }],
                  nextUniqueId: evId + 1
                };
              })}
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
            ${data.episodes.map((ep, epIdx) => html`
              <div key=${ep.id} className="space-y-1">
                <div 
                  className=${`p-2 rounded cursor-pointer flex justify-between items-center group ${selectedEpisodeId === ep.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                  onClick=${() => {
                    if (selectedEpisodeId !== ep.id) {
                      setSelectedEpisodeId(ep.id);
                      if (ep.events.length > 0) setSelectedEventId(ep.events[0].id);
                      else setSelectedEventId(null);
                    }
                  }}
                >
                  <input 
                    className="truncate flex-1 bg-transparent border-none focus:ring-0 p-0 font-medium cursor-pointer min-w-0"
                    value=${ep.title}
                    onChange=${(e) => updateData(prev => ({
                      ...prev,
                      episodes: prev.episodes.map(x => x.id === ep.id ? { ...x, title: e.target.value } : x)
                    }))}
                  />
                  <div className="flex items-center opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                    <button 
                      onClick=${(e) => {
                        e.stopPropagation();
                        updateData(prev => ({
                          ...prev,
                          episodes: prev.episodes.map(x => x.id === ep.id ? {
                            ...x,
                            events: [...x.events, {
                              id: prev.nextUniqueId,
                              title: `${x.title}-${x.events.length + 1}`,
                              messages: [],
                              teams: {}
                            }]
                          } : x),
                          nextUniqueId: prev.nextUniqueId + 1
                        }));
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-green-600"
                      title="Add Event"
                    >
                      <${LucideReact.Plus} size=${14} />
                    </button>
                    <button 
                      disabled=${epIdx === 0}
                      onClick=${(e) => {
                        e.stopPropagation();
                        updateData(prev => {
                          const episodes = [...prev.episodes];
                          [episodes[epIdx], episodes[epIdx - 1]] = [episodes[epIdx - 1], episodes[epIdx]];
                          return { ...prev, episodes };
                        });
                      }}
                      className=${`p-1 hover:bg-gray-200 rounded text-gray-500 ${epIdx === 0 ? 'opacity-30' : ''}`}
                      title="Move Up"
                    >
                      <${LucideReact.ArrowUp} size=${14} />
                    </button>
                    <button 
                      disabled=${epIdx === data.episodes.length - 1}
                      onClick=${(e) => {
                        e.stopPropagation();
                        updateData(prev => {
                          const episodes = [...prev.episodes];
                          [episodes[epIdx], episodes[epIdx + 1]] = [episodes[epIdx + 1], episodes[epIdx]];
                          return { ...prev, episodes };
                        });
                      }}
                      className=${`p-1 hover:bg-gray-200 rounded text-gray-500 ${epIdx === data.episodes.length - 1 ? 'opacity-30' : ''}`}
                      title="Move Down"
                    >
                      <${LucideReact.ArrowDown} size=${14} />
                    </button>
                    <button 
                      onClick=${(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this episode?')) {
                          updateData(prev => ({
                            ...prev,
                            episodes: prev.episodes.filter(x => x.id !== ep.id)
                          }));
                          if (selectedEpisodeId === ep.id) {
                            setSelectedEpisodeId(null);
                            setSelectedEventId(null);
                          }
                        }
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-red-600"
                      title="Delete Episode"
                    >
                      <${LucideReact.Trash2} size=${14} />
                    </button>
                  </div>
                </div>
                ${ep.events.map((ev, evIdx) => html`
                  <div 
                    key=${ev.id}
                    className=${`ml-4 p-2 text-sm rounded cursor-pointer flex justify-between items-center group ${selectedEventId === ev.id ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100'}`}
                    onClick=${() => {
                      setSelectedEpisodeId(ep.id);
                      setSelectedEventId(ev.id);
                    }}
                  >
                    <input 
                      className="truncate flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm cursor-pointer min-w-0"
                      value=${ev.title}
                      onChange=${(e) => updateData(prev => ({
                        ...prev,
                        episodes: prev.episodes.map(x => x.id === ep.id ? {
                          ...x,
                          events: x.events.map(y => y.id === ev.id ? { ...y, title: e.target.value } : y)
                        } : x)
                      }))}
                    />
                    <div className="flex items-center opacity-0 group-hover:opacity-100 shrink-0 ml-1">
                      <button 
                        disabled=${evIdx === 0}
                        onClick=${(e) => {
                          e.stopPropagation();
                          updateData(prev => {
                            const episodes = prev.episodes.map(x => {
                              if (x.id !== ep.id) return x;
                              const events = [...x.events];
                              [events[evIdx], events[evIdx - 1]] = [events[evIdx - 1], events[evIdx]];
                              return { ...x, events };
                            });
                            return { ...prev, episodes };
                          });
                        }}
                        className=${`p-1 hover:bg-gray-200 rounded text-gray-500 ${evIdx === 0 ? 'opacity-30' : ''}`}
                        title="Move Up"
                      >
                        <${LucideReact.ArrowUp} size=${12} />
                      </button>
                      <button 
                        disabled=${evIdx === ep.events.length - 1}
                        onClick=${(e) => {
                          e.stopPropagation();
                          updateData(prev => {
                            const episodes = prev.episodes.map(x => {
                              if (x.id !== ep.id) return x;
                              const events = [...x.events];
                              [events[evIdx], events[evIdx + 1]] = [events[evIdx + 1], events[evIdx]];
                              return { ...x, events };
                            });
                            return { ...prev, episodes };
                          });
                        }}
                        className=${`p-1 hover:bg-gray-200 rounded text-gray-500 ${evIdx === ep.events.length - 1 ? 'opacity-30' : ''}`}
                        title="Move Down"
                      >
                        <${LucideReact.ArrowDown} size=${12} />
                      </button>
                      <button 
                        onClick=${(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this event?')) {
                            updateData(prev => ({
                              ...prev,
                              episodes: prev.episodes.map(x => x.id === ep.id ? {
                                ...x,
                                events: x.events.filter(y => y.id !== ev.id)
                              } : x)
                            }));
                            if (selectedEventId === ev.id) {
                              const remainingEvents = ep.events.filter(y => y.id !== ev.id);
                              setSelectedEventId(remainingEvents[0]?.id || null);
                            }
                          }
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-red-600"
                        title="Delete Event"
                      >
                        <${LucideReact.Trash2} size=${12} />
                      </button>
                    </div>
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
                      const val = document.getElementById('data-textarea').value.trim();
                      if (!val) {
                        setData(DEFAULT_DATA);
                        setIsDataModalOpen(false);
                        return;
                      }
                      const parsed = JSON.parse(val);
                      // Basic validation to ensure required fields exist
                      if (!parsed.people || !parsed.episodes) {
                        throw new Error('Missing required fields: people or episodes');
                      }
                      // Normalization: Ensure all fields exist and recompute nextUniqueId
                      const normalized = {
                        ...DEFAULT_DATA,
                        ...parsed,
                        people: (parsed.people || []).map(p => ({
                          description: '',
                          image: '',
                          ranges: '',
                          ...p
                        })),
                        episodes: (parsed.episodes || []).map(ep => ({
                          title: 'New Episode',
                          events: [],
                          ...ep,
                          events: (ep.events || []).map(ev => ({
                            title: 'New Event',
                            messages: [],
                            teams: {},
                            ...ev
                          }))
                        }))
                      };
                      
                      // Recompute nextUniqueId based on existing IDs
                      let maxId = 0;
                      normalized.people.forEach(p => maxId = Math.max(maxId, p.id || 0));
                      normalized.episodes.forEach(ep => {
                        maxId = Math.max(maxId, ep.id || 0);
                        ep.events.forEach(ev => maxId = Math.max(maxId, ev.id || 0));
                      });
                      normalized.nextUniqueId = Math.max(normalized.nextUniqueId || 0, maxId + 1);

                      setData(normalized);
                      setIsDataModalOpen(false);
                    } catch (e) {
                      alert('Error loading data: ' + e.message);
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
