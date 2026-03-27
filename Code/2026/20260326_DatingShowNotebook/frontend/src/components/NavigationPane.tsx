import React, { useState } from 'react';
import { useStore, Episode } from '../store/useStore';
import { ChevronDown, Plus } from 'lucide-react';
import { clsx } from 'clsx';

const NavigationPane: React.FC = () => {
  const { data, selectedEpisodeId, selectedEventId, setSelectedView, saveData } = useStore();
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const handleAddEpisode = () => {
    const nextId = (data.episodes.length > 0 ? Math.max(...data.episodes.map(e => e.id)) : 0) + 1;
    const newEpisode: Episode = {
      id: nextId,
      events: [{ id: `${nextId}-1`, title: `Episode ${nextId}-1`, messages: [], teams: {} }]
    };
    saveData({
      ...data,
      episodes: [...data.episodes, newEpisode]
    });
    setOpenDropdown(null);
  };

  const handleAddEvent = (episodeId: number) => {
    const episode = data.episodes.find(e => e.id === episodeId);
    if (!episode) return;
    const nextEventIndex = episode.events.length + 1;
    const newEvent = {
      id: `${episodeId}-${nextEventIndex}`,
      title: `Episode ${episodeId}-${nextEventIndex}`,
      messages: [],
      teams: {}
    };
    saveData({
      ...data,
      episodes: data.episodes.map(e => e.id === episodeId ? { ...e, events: [...e.events, newEvent] } : e)
    });
    setOpenDropdown(null);
  };

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col h-full overflow-y-auto">
      <div className="p-4 text-xl font-bold border-b border-gray-700">Dating Notebook</div>
      
      <button
        className={clsx(
          "p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700",
          selectedEpisodeId === null && "bg-blue-600"
        )}
        onClick={() => setSelectedView(null, null)}
      >
        Person View
      </button>

      <div className="flex-1">
        {data.episodes.map(episode => (
          <div key={episode.id} className="border-b border-gray-700">
            {episode.events.map(event => (
              <div key={event.id} className="flex items-center group relative">
                <button
                  className={clsx(
                    "flex-1 p-3 pl-6 text-left hover:bg-gray-700 transition-colors",
                    selectedEventId === event.id && "bg-blue-600"
                  )}
                  onClick={() => setSelectedView(episode.id, event.id)}
                >
                  {event.id}
                </button>
                <div className="relative">
                  <button
                    className="p-3 hover:bg-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(openDropdown === episode.id ? null : episode.id);
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {openDropdown === episode.id && (
                    <div className="absolute left-0 mt-1 w-40 bg-white text-gray-900 rounded shadow-lg z-50">
                      <button
                        className="w-full p-2 text-left hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleAddEpisode()}
                      >
                        <Plus size={14} /> New Episode
                      </button>
                      <button
                        className="w-full p-2 text-left hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleAddEvent(episode.id)}
                      >
                        <Plus size={14} /> New Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {data.episodes.length === 0 && (
          <button
            className="w-full p-4 text-left hover:bg-gray-700 flex items-center gap-2 text-blue-400"
            onClick={handleAddEpisode}
          >
            <Plus size={18} /> Initialize Episode 1
          </button>
        )}
      </div>
    </div>
  );
};

export default NavigationPane;
