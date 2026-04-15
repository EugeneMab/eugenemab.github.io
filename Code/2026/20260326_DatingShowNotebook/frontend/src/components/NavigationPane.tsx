import React, { useState, useEffect, useRef } from 'react';
import { useStore, Episode, Event } from '../store/useStore';
import { ChevronDown, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

const ICON_SIZE_14 = 14;
const ICON_SIZE_16 = 16;
const ICON_SIZE_18 = 18;

const NavigationPane: React.FC = () => {
  const { data, selectedEpisodeId, selectedEventId, setSelectedView, saveData, fullRefresh } =
    useStore();
  const [openDropdown, setOpenDropdown] = useState<{
    type: 'episode' | 'event';
    id: number;
    showAbove?: boolean;
  } | null>(null);

  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (paneRef.current && !paneRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleToggleDropdown = (e: React.MouseEvent, type: 'episode' | 'event', id: number) => {
    e.stopPropagation();
    if (openDropdown?.id === id && openDropdown?.type === type) {
      setOpenDropdown(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const showAbove = rect.bottom > window.innerHeight / 2;
      setOpenDropdown({ type, id, showAbove });
    }
  };

  const handleAddEpisode = () => {
    saveData((prev) => {
      let nextUid = prev.nextUniqueId;
      const epId = nextUid++;
      const evId = nextUid++;

      const title = `Episode ${prev.episodes.length + 1}`;
      const newEpisode: Episode = {
        id: epId,
        title: title,
        events: [{ id: evId, title: `${title}-1`, messages: [], teams: {} }],
      };
      return {
        ...prev,
        episodes: [...prev.episodes, newEpisode],
        nextUniqueId: nextUid,
      };
    });
    return setOpenDropdown(null);
  };

  const handleAddEvent = (episodeId: number) => {
    saveData((prev) => {
      const episode = prev.episodes.find((e) => {
        return e.id === episodeId;
      });
      if (!episode) {
        return prev;
      }

      let nextUid = prev.nextUniqueId;
      const evId = nextUid++;

      const nextEventIndex = episode.events.length + 1;
      const newEvent: Event = {
        id: evId,
        title: `${episode.title}-${nextEventIndex}`,
        messages: [],
        teams: {},
      };
      return {
        ...prev,
        episodes: prev.episodes.map((e) => {
          return e.id === episodeId ? { ...e, events: [...e.events, newEvent] } : e;
        }),
        nextUniqueId: nextUid,
      };
    });
    return setOpenDropdown(null);
  };

  const handleDeleteEpisode = (episodeId: number) => {
    if (window.confirm('Are you sure you want to delete this episode and all its events?')) {
      saveData((prev) => {
        return {
          ...prev,
          episodes: prev.episodes.filter((e) => {
            return e.id !== episodeId;
          }),
        };
      });
      if (selectedEpisodeId === episodeId) {
        setSelectedView(null, null);
      }
    }
    return setOpenDropdown(null);
  };

  const handleMoveEpisode = (index: number, direction: 'up' | 'down') => {
    saveData((prev) => {
      const newEpisodes = [...prev.episodes];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newEpisodes.length) {
        [newEpisodes[index], newEpisodes[targetIndex]] = [
          newEpisodes[targetIndex],
          newEpisodes[index],
        ];
        return { ...prev, episodes: newEpisodes };
      }
      return prev;
    });
    return setOpenDropdown(null);
  };

  const handleDeleteEvent = (episodeId: number, eventId: number) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      saveData((prev) => {
        const ep = prev.episodes.find((e) => {
          return e.id === episodeId;
        });
        if (!ep) {
          return prev;
        }

        const updatedEpisodes = prev.episodes.map((episode) => {
          return episode.id === episodeId
            ? {
                ...episode,
                events: episode.events.filter((ev) => {
                  return ev.id !== eventId;
                }),
              }
            : episode;
        });

        return {
          ...prev,
          episodes: updatedEpisodes,
        };
      });

      // Selection logic remains outside as it doesn't affect the data saved
      if (selectedEventId === eventId) {
        const ep = data.episodes.find((e) => {
          return e.id === episodeId;
        });
        const remainingEvents =
          ep?.events.filter((ev) => {
            return ev.id !== eventId;
          }) || [];
        setSelectedView(episodeId, remainingEvents[0]?.id || null);
      }
    }
    return setOpenDropdown(null);
  };

  const handleMoveEvent = (episodeId: number, eventIndex: number, direction: 'up' | 'down') => {
    saveData((prev) => {
      const episode = prev.episodes.find((e) => {
        return e.id === episodeId;
      });
      if (!episode) {
        return prev;
      }
      const newEvents = [...episode.events];
      const targetIndex = direction === 'up' ? eventIndex - 1 : eventIndex + 1;
      if (targetIndex >= 0 && targetIndex < newEvents.length) {
        [newEvents[eventIndex], newEvents[targetIndex]] = [
          newEvents[targetIndex],
          newEvents[eventIndex],
        ];
        return {
          ...prev,
          episodes: prev.episodes.map((ep) => {
            return ep.id === episodeId ? { ...ep, events: newEvents } : ep;
          }),
        };
      }
      return prev;
    });
    return setOpenDropdown(null);
  };

  const updateEpisodeTitle = (episodeId: number, newTitle: string) => {
    return saveData((prev) => {
      return {
        ...prev,
        episodes: prev.episodes.map((e) => {
          return e.id === episodeId ? { ...e, title: newTitle } : e;
        }),
      };
    });
  };

  const updateEventTitle = (episodeId: number, eventId: number, newTitle: string) => {
    return saveData((prev) => {
      return {
        ...prev,
        episodes: prev.episodes.map((ep) => {
          return ep.id === episodeId
            ? {
                ...ep,
                events: ep.events.map((ev) => {
                  return ev.id === eventId ? { ...ev, title: newTitle } : ev;
                }),
              }
            : ep;
        }),
      };
    });
  };

  return (
    <div
      ref={paneRef}
      className="w-64 bg-[#8B008B] text-white flex flex-col h-full shrink-0 relative z-30 overflow-x-hidden"
    >
      <button
        className="p-4 text-xl font-bold border-b border-pink-800/50 text-left hover:bg-[#9B109B] transition-colors bg-[#8B008B] shrink-0"
        onClick={() => {
          return fullRefresh();
        }}
      >
        Dating Show Notes
      </button>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <button
          className={clsx(
            'w-full p-4 text-left hover:bg-[#9B109B] transition-colors border-b border-pink-800/50',
            selectedEpisodeId === null ? 'bg-[#B020B0]' : 'bg-transparent'
          )}
          onClick={() => {
            return setSelectedView(null, null);
          }}
        >
          Person View
        </button>

        <div className="flex-1">
          {data.episodes.map((episode, epIdx) => {
            const isSelected = episode.id === selectedEpisodeId;
            const isEpisodeDropdownOpen =
              openDropdown?.type === 'episode' && openDropdown.id === episode.id;

            return (
              <div
                key={episode.id}
                className={clsx(
                  'border-b border-pink-800/50',
                  isEpisodeDropdownOpen ? 'relative z-10' : 'relative z-0'
                )}
              >
                <div className="flex items-center group relative w-full">
                  <div
                    className={clsx(
                      'flex-1 flex items-center hover:bg-[#9B109B] transition-colors min-w-0',
                      isSelected && 'bg-[#9B109B]'
                    )}
                  >
                    <input
                      className={clsx(
                        'flex-1 p-3 pl-4 bg-transparent border-none focus:ring-0 font-bold min-w-0',
                        isSelected ? 'text-pink-200' : 'text-white'
                      )}
                      value={episode.title || `Episode ${episode.id}`}
                      onChange={(e) => {
                        return updateEpisodeTitle(episode.id, e.target.value);
                      }}
                      onClick={() => {
                        return setSelectedView(episode.id, episode.events[0]?.id || null);
                      }}
                    />
                  </div>
                  <div className="relative shrink-0 pr-1">
                    <button
                      className="p-3 hover:bg-pink-800/30 text-white/70 hover:text-white"
                      onClick={(e) => {
                        return handleToggleDropdown(e, 'episode', episode.id);
                      }}
                    >
                      <ChevronDown size={ICON_SIZE_16} />
                    </button>
                    {isEpisodeDropdownOpen && (
                      <div
                        className={clsx(
                          'absolute right-0 w-48 bg-white text-gray-900 rounded shadow-xl z-20 border border-gray-200',
                          openDropdown.showAbove ? 'bottom-full mb-0' : 'top-full mt-0'
                        )}
                      >
                        <button
                          className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100"
                          onClick={() => {
                            return handleAddEvent(episode.id);
                          }}
                        >
                          <Plus size={ICON_SIZE_14} /> New Event
                        </button>
                        <button
                          className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                          disabled={epIdx === 0}
                          onClick={() => {
                            return handleMoveEpisode(epIdx, 'up');
                          }}
                        >
                          <ArrowUp size={ICON_SIZE_14} /> Move Up
                        </button>
                        <button
                          className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                          disabled={epIdx === data.episodes.length - 1}
                          onClick={() => {
                            return handleMoveEpisode(epIdx, 'down');
                          }}
                        >
                          <ArrowDown size={ICON_SIZE_14} /> Move Down
                        </button>
                        <button
                          className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                          onClick={() => {
                            return handleDeleteEpisode(episode.id);
                          }}
                        >
                          <Trash2 size={ICON_SIZE_14} /> Delete Episode
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#5A005A]">
                  {episode.events.map((event, evIdx) => {
                    const isEventDropdownOpen =
                      openDropdown?.type === 'event' && openDropdown.id === event.id;
                    return (
                      <div
                        key={event.id}
                        className={clsx(
                          'flex items-center group relative w-full',
                          isEventDropdownOpen ? 'relative z-10' : 'z-0'
                        )}
                      >
                        <div
                          className={clsx(
                            'flex-1 flex items-center hover:bg-[#7A007A] transition-colors min-w-0',
                            selectedEventId === event.id && 'bg-pink-600'
                          )}
                        >
                          <input
                            className={clsx(
                              'flex-1 p-2 pl-8 bg-transparent border-none focus:ring-0 text-sm min-w-0',
                              selectedEventId === event.id ? 'text-white' : 'text-pink-200'
                            )}
                            value={event.title}
                            onChange={(e) => {
                              return updateEventTitle(episode.id, event.id, e.target.value);
                            }}
                            onClick={() => {
                              return setSelectedView(episode.id, event.id);
                            }}
                          />
                        </div>
                        <div className="relative shrink-0 pr-1">
                          <button
                            className={clsx(
                              'p-2 hover:bg-pink-800/30 text-pink-200 group-hover:block hover:text-white',
                              openDropdown?.id === event.id ? 'block' : 'hidden'
                            )}
                            onClick={(e) => {
                              return handleToggleDropdown(e, 'event', event.id);
                            }}
                          >
                            <ChevronDown size={ICON_SIZE_14} />
                          </button>
                          {isEventDropdownOpen && (
                            <div
                              className={clsx(
                                'absolute right-0 w-48 bg-white text-gray-900 rounded shadow-xl z-20 border border-gray-200',
                                openDropdown.showAbove ? 'bottom-full mb-0' : 'top-full mt-0'
                              )}
                            >
                              <button
                                className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                                disabled={evIdx === 0}
                                onClick={() => {
                                  return handleMoveEvent(episode.id, evIdx, 'up');
                                }}
                              >
                                <ArrowUp size={ICON_SIZE_14} /> Move Up
                              </button>
                              <button
                                className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 disabled:opacity-50"
                                disabled={evIdx === episode.events.length - 1}
                                onClick={() => {
                                  return handleMoveEvent(episode.id, evIdx, 'down');
                                }}
                              >
                                <ArrowDown size={ICON_SIZE_14} /> Move Down
                              </button>
                              <button
                                className="w-full p-3 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                                onClick={() => {
                                  return handleDeleteEvent(episode.id, event.id);
                                }}
                              >
                                <Trash2 size={ICON_SIZE_14} /> Delete Event
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            className="w-full p-4 text-left hover:bg-[#9B109B] flex items-center gap-2 text-pink-100 border-b border-pink-800/50 transition-colors"
            onClick={() => {
              return handleAddEpisode();
            }}
          >
            <Plus size={ICON_SIZE_18} /> Add New Episode
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPane;
