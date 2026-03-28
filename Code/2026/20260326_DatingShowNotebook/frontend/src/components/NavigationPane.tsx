import React, { useState } from 'react';
import { useStore, Episode, Event } from '../store/useStore';
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

const NavigationPane: React.FC = () => {
  const { data, selectedEpisodeId, selectedEventId, setSelectedView, saveData } = useStore();
  const [openDropdown, setOpenDropdown] = useState<{ type: 'episode' | 'event', id: number | string } | null>(null);

  const handleAddEpisode = () => {
    let nextUid = data.nextUniqueId;
    const epId = nextUid++;
    const evId = nextUid++;
    
    const title = `Episode ${data.episodes.length + 1}`;
    const newEpisode: Episode = {
      id: epId,
      title: title,
      events: [{ id: evId, title: `${title}-1`, messages: [], teams: {} }]
    };
    saveData({
      ...data,
      episodes: [...data.episodes, newEpisode],
      nextUniqueId: nextUid
    });
    setOpenDropdown(null);
  };

  const handleAddEvent = (episodeId: number) => {
    const episode = data.episodes.find(e => e.id === episodeId);
    if (!episode) return;
    
    let nextUid = data.nextUniqueId;
    const evId = nextUid++;
    
    const nextEventIndex = episode.events.length + 1;
    const newEvent: Event = {
      id: evId,
      title: `${episode.title}-${nextEventIndex}`,
      messages: [],
      teams: {}
    };
    saveData({
      ...data,
      episodes: data.episodes.map(e => e.id === episodeId ? { ...e, events: [...e.events, newEvent] } : e),
      nextUniqueId: nextUid
    });
    setOpenDropdown(null);
  };

  const handleDeleteEpisode = (episodeId: number) => {
    if (window.confirm('Are you sure you want to delete this episode and all its events?')) {
      saveData({
        ...data,
        episodes: data.episodes.filter(e => e.id !== episodeId)
      });
      if (selectedEpisodeId === episodeId) {
        setSelectedView(null, null);
      }
    }
    setOpenDropdown(null);
  };

  const handleMoveEpisode = (index: number, direction: 'up' | 'down') => {
    const newEpisodes = [...data.episodes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newEpisodes.length) {
      [newEpisodes[index], newEpisodes[targetIndex]] = [newEpisodes[targetIndex], newEpisodes[index]];
      saveData({ ...data, episodes: newEpisodes });
    }
    setOpenDropdown(null);
  };

  const handleDeleteEvent = (episodeId: number, eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      saveData({
        ...data,
        episodes: data.episodes.map(ep => ep.id === episodeId ? {
          ...ep,
          events: ep.events.filter(ev => ev.id !== eventId)
        } : ep)
      });
      if (selectedEventId === eventId) {
        const ep = data.episodes.find(e => e.id === episodeId);
        const remainingEvents = ep?.events.filter(ev => ev.id !== eventId) || [];
        setSelectedView(episodeId, remainingEvents[0]?.id || null);
      }
    }
    setOpenDropdown(null);
  };

  const handleMoveEvent = (episodeId: number, eventIndex: number, direction: 'up' | 'down') => {
    const episode = data.episodes.find(e => e.id === episodeId);
    if (!episode) return;
    const newEvents = [...episode.events];
    const targetIndex = direction === 'up' ? eventIndex - 1 : eventIndex + 1;
    if (targetIndex >= 0 && targetIndex < newEvents.length) {
      [newEvents[eventIndex], newEvents[targetIndex]] = [newEvents[targetIndex], newEvents[eventIndex]];
      saveData({
        ...data,
        episodes: data.episodes.map(ep => ep.id === episodeId ? { ...ep, events: newEvents } : ep)
      });
    }
    setOpenDropdown(null);
  };

  const updateEpisodeTitle = (episodeId: number, newTitle: string) => {
    saveData({
      ...data,
      episodes: data.episodes.map(e => e.id === episodeId ? { ...e, title: newTitle } : e)
    });
  };

  const updateEventTitle = (episodeId: number, eventId: string, newTitle: string) => {
    saveData({
      ...data,
      episodes: data.episodes.map(ep => ep.id === episodeId ? {
        ...ep,
        events: ep.events.map(ev => ev.id === eventId ? { ...ev, title: newTitle } : ev)
      } : ep)
    });
  };

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col h-full overflow-y-auto shrink-0 relative z-50">
      <div className="p-4 text-xl font-bold border-b border-gray-700">Dating Show Notes</div>
      
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
        {data.episodes.map((episode, epIdx) => {
          const isSelected = episode.id === selectedEpisodeId;
          return (
            <div key={episode.id} className="border-b border-gray-700">
              <div className="flex items-center group relative">
                <div
                  className={clsx(
                    "flex-1 flex items-center hover:bg-gray-700 transition-colors",
                    isSelected && "bg-gray-700"
                  )}
                >
                  <input
                    className={clsx(
                      "flex-1 p-3 pl-4 bg-transparent border-none focus:ring-0 font-bold",
                      isSelected ? "text-blue-400" : "text-white"
                    )}
                    value={episode.title || `Episode ${episode.id}`}
                    onChange={(e) => updateEpisodeTitle(episode.id, e.target.value)}
                    onClick={() => setSelectedView(episode.id, episode.events[0]?.id || null)}
                  />
                </div>
                <div className="relative">
                  <button
                    className="p-3 hover:bg-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(openDropdown?.id === episode.id ? null : { type: 'episode', id: episode.id });
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {openDropdown?.type === 'episode' && openDropdown.id === episode.id && (
                    <div className="absolute right-0 top-full mt-0 w-48 bg-white text-gray-900 rounded shadow-xl z-[100] border border-gray-200">
                      <button
                        className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100"
                        onClick={() => handleAddEvent(episode.id)}
                      >
                        <Plus size={14} /> New Event
                      </button>
                      <button
                        className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                        disabled={epIdx === 0}
                        onClick={() => handleMoveEpisode(epIdx, 'up')}
                      >
                        <ArrowUp size={14} /> Move Up
                      </button>
                      <button
                        className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                        disabled={epIdx === data.episodes.length - 1}
                        onClick={() => handleMoveEpisode(epIdx, 'down')}
                      >
                        <ArrowDown size={14} /> Move Down
                      </button>
                      <button
                        className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                        onClick={() => handleDeleteEpisode(episode.id)}
                      >
                        <Trash2 size={14} /> Delete Episode
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-900">
                {episode.events.map((event, evIdx) => (
                  <div key={event.id} className="flex items-center group relative">
                    <div
                      className={clsx(
                        "flex-1 flex items-center hover:bg-gray-700 transition-colors",
                        selectedEventId === event.id && "bg-blue-600"
                      )}
                    >
                      <input
                        className={clsx(
                          "flex-1 p-2 pl-8 bg-transparent border-none focus:ring-0 text-sm",
                          selectedEventId === event.id ? "text-white" : "text-gray-400"
                        )}
                        value={event.title}
                        onChange={(e) => updateEventTitle(episode.id, event.id, e.target.value)}
                        onClick={() => setSelectedView(episode.id, event.id)}
                      />
                    </div>
                    <div className="relative">
                      <button
                        className={clsx(
                          "p-2 hover:bg-gray-600 text-gray-400 group-hover:block",
                          openDropdown?.id === event.id ? "block" : "hidden"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdown(openDropdown?.id === event.id ? null : { type: 'event', id: event.id });
                        }}
                      >
                        <ChevronDown size={14} />
                      </button>
                      {openDropdown?.type === 'event' && openDropdown.id === event.id && (
                        <div className="absolute right-0 top-full mt-0 w-48 bg-white text-gray-900 rounded shadow-xl z-[100] border border-gray-200">
                          <button
                            className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                            disabled={evIdx === 0}
                            onClick={() => handleMoveEvent(episode.id, evIdx, 'up')}
                          >
                            <ArrowUp size={14} /> Move Up
                          </button>
                          <button
                            className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                            disabled={evIdx === episode.events.length - 1}
                            onClick={() => handleMoveEvent(episode.id, evIdx, 'down')}
                          >
                            <ArrowDown size={14} /> Move Down
                          </button>
                          <button
                            className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                            onClick={() => handleDeleteEvent(episode.id, event.id)}
                          >
                            <Trash2 size={14} /> Delete Event
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        <button
          className="w-full p-4 text-left hover:bg-gray-700 flex items-center gap-2 text-blue-400 border-b border-gray-700"
          onClick={handleAddEpisode}
        >
          <Plus size={18} /> Add New Episode
        </button>
      </div>
    </div>
  );
};

export default NavigationPane;
