import { create } from 'zustand';
import axios from 'axios';
import { renderEventToSvgString } from '../utils/svgRenderer';
import { svgToJpeg, saveEventImage, cleanupZombieImages } from '../utils/imageGen';

export type Gender = 'male' | 'female';
export type MessageType = 'strong' | 'weak' | 'bidirectional';

export interface Person {
  id: number;
  gender: Gender;
  name: string;
  image: string; // base64
  description: string;
  ranges: string;
}

export interface Message {
  from: number;
  to: number;
  type: MessageType;
}

export interface Event {
  id: number;
  title: string;
  messages: Message[];
  teams: { [teamIndex: string]: number[] };
}

export interface Episode {
  id: number;
  title: string;
  events: Event[];
}

export interface AppData {
  people: Person[];
  episodes: Episode[];
  nextUniqueId: number;
  bodyScale: number;
  descriptionScale: number;
}

export type ActiveMode =
  | 'select'
  | 'message'
  | 'weak-message'
  | 'bidirectional-message'
  | 'team-0'
  | 'team-1'
  | 'team-2'
  | 'team-3'
  | 'team-4'
  | 'team-5'
  | 'team-6'
  | 'team-7'
  | 'team-8'
  | 'team-9'
  | 'eraser';

interface AppState {
  data: AppData;
  activeMode: ActiveMode;
  selectedEpisodeId: number | null;
  selectedEventId: number | null;
  undoStack: AppData[];

  isRefreshing: boolean;
  isOpening: boolean;
  refreshProgress: { current: number; total: number };
  cancelRefresh: boolean;

  clientId: string;
  currentFolderPath: string | null;
  recentFolders: string[];
  isInterrupted: boolean;

  openFolder: (path: string) => Promise<void>;
  saveData: (update: (prev: AppData) => AppData) => Promise<void>;
  setActiveMode: (mode: ActiveMode) => void;
  // ... (rest of the interface)
  setInterrupted: (interrupted: boolean) => void;
}

const ID_RADIX = 36;
const RECENT_FOLDERS_LIMIT = 10;
const UNDO_STACK_LIMIT = 50;
const SAVE_DEBOUNCE_MS = 500;
const REFRESH_DELAY_MS = 300;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(ID_RADIX).substring(2) + Date.now().toString(ID_RADIX);
};
const CLIENT_ID = generateId();

/**
 * Encodes a string to a URL-safe base64 string.
 */
export function toSafeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds a URL with folder and client-id parameters.
 */
function buildUrl(baseUrl: string, folderPath: string | null, clientId: string): string {
  if (!folderPath) {
    return baseUrl;
  }
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('folder', toSafeBase64(folderPath));
  url.searchParams.set('client-id', clientId);
  return url.pathname + url.search;
}

const savedRecent = localStorage.getItem('dsn_recent_folders');
const initialRecent = savedRecent ? JSON.parse(savedRecent) : [];

let globalSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((set, get) => {
  return {
    data: {
      people: [],
      episodes: [],
      nextUniqueId: 1,
      bodyScale: 1,
      descriptionScale: 1,
    },
    activeMode: 'message',
    selectedEpisodeId: null,
    selectedEventId: null,
    undoStack: [],
    isRefreshing: false,
    isOpening: false,
    refreshProgress: { current: 0, total: 0 },
    cancelRefresh: false,

    clientId: CLIENT_ID,
    currentFolderPath: null,
    recentFolders: initialRecent,
    isInterrupted: false,

    openFolder: async (folderPath) => {
      if (get().isOpening) {
        return;
      }
      set({ isOpening: true });

      try {
        const clientId = get().clientId;
        const res = await axios.post('/api/open', { path: folderPath, clientId });
        const data: AppData = res.data;

        // --- ID Compaction & Data Cleaning Logic ---
        const personMap = new Map<number, number>();
        const episodeMap = new Map<number, number>();
        const eventMap = new Map<number, number>();
        let nextId = 1;

        data.people.forEach((p) => {
          personMap.set(p.id, nextId++);
        });

        data.episodes.forEach((ep) => {
          episodeMap.set(ep.id, nextId++);
          ep.events.forEach((ev) => {
            eventMap.set(ev.id, nextId++);
          });
        });

        data.nextUniqueId = nextId;

        const validPersonIds = new Set(personMap.values());

        data.people.forEach((p) => {
          p.id = personMap.get(p.id)!;
        });

        data.episodes.forEach((ep) => {
          ep.id = episodeMap.get(ep.id)!;
          ep.events.forEach((ev) => {
            ev.id = eventMap.get(ev.id)!;
            const seenMessages = new Set<string>();
            ev.messages = ev.messages
              .map((m) => {
                return {
                  ...m,
                  from: personMap.get(m.from)!,
                  to: personMap.get(m.to)!,
                };
              })
              .filter((m) => {
                if (!m.from || !m.to || !validPersonIds.has(m.from) || !validPersonIds.has(m.to)) {
                  return false;
                }
                let key;
                if (m.type === 'bidirectional') {
                  const sortedIds = [m.from, m.to].sort((a, b) => a - b);
                  key = `${sortedIds[0]}-${sortedIds[1]}-${m.type}`;
                } else {
                  key = `${m.from}-${m.to}-${m.type}`;
                }
                if (seenMessages.has(key)) {
                  return false;
                }
                seenMessages.add(key);
                return true;
              });

            const cleanedTeams: { [teamIndex: string]: number[] } = {};
            Object.entries(ev.teams).forEach(([idx, members]) => {
              const validMembers = members
                .map((id) => {
                  return personMap.get(id)!;
                })
                .filter((id) => {
                  return id && validPersonIds.has(id);
                });
              const uniqueMembers = Array.from(new Set(validMembers));
              if (uniqueMembers.length > 0) {
                cleanedTeams[idx] = uniqueMembers;
              }
            });
            ev.teams = cleanedTeams;
          });
        });

        let lastEpisodeId = null;
        let lastEventId = null;
        if (data.episodes.length > 0) {
          const lastEpisode = data.episodes[data.episodes.length - 1];
          lastEpisodeId = lastEpisode.id;
          if (lastEpisode.events.length > 0) {
            lastEventId = lastEpisode.events[lastEpisode.events.length - 1].id;
          }
        }

        const newRecent = [
          folderPath,
          ...get().recentFolders.filter((p) => {
            return p !== folderPath;
          }),
        ].slice(0, RECENT_FOLDERS_LIMIT);
        localStorage.setItem('dsn_recent_folders', JSON.stringify(newRecent));

        set({
          data,
          currentFolderPath: folderPath,
          selectedEpisodeId: lastEpisodeId,
          selectedEventId: lastEventId,
          activeMode: 'message',
          recentFolders: newRecent,
          undoStack: [],
          isOpening: false,
          isInterrupted: false,
        });

        await axios.post(buildUrl('/api/data', folderPath, clientId), data);
      } catch (e) {
        console.error('Failed to open folder', e);
        set({ isOpening: false });
        throw e;
      }
    },

    saveData: async (update) => {
      const folderPath = get().currentFolderPath;
      if (!folderPath) {
        return;
      }

      set((state) => {
        const currentData = state.data;
        const newData = update(currentData);

        if (globalSaveTimeout) {
          clearTimeout(globalSaveTimeout);
        }
        globalSaveTimeout = setTimeout(async () => {
          const latestState = useStore.getState();
          if (!latestState.currentFolderPath) {
            return;
          }

          try {
            await axios.post(
              buildUrl('/api/data', latestState.currentFolderPath, latestState.clientId),
              latestState.data
            );
          } catch (_e) {
            console.error('Failed to save data to backend', _e);
          }
        }, SAVE_DEBOUNCE_MS);

        return {
          undoStack: [JSON.parse(JSON.stringify(currentData)), ...state.undoStack].slice(
            0,
            UNDO_STACK_LIMIT
          ),
          data: newData,
        };
      });
    },

    setActiveMode: (mode) => {
      return set({ activeMode: mode });
    },

    setSelectedView: (episodeId, eventId) => {
      return set({
        selectedEpisodeId: episodeId,
        selectedEventId: eventId,
        activeMode: 'message',
      });
    },

    setBodyScale: (scale) => {
      get().saveData((prev) => {
        return { ...prev, bodyScale: scale };
      });
    },

    setDescriptionScale: (scale) => {
      get().saveData((prev) => {
        return { ...prev, descriptionScale: scale };
      });
    },

    undo: () => {
      const folderPath = get().currentFolderPath;
      if (!folderPath) {
        return;
      }

      const stack = get().undoStack;
      if (stack.length === 0) {
        return;
      }
      const [prevData, ...remainingStack] = stack;
      set({
        data: prevData,
        undoStack: remainingStack,
      });

      axios.post(buildUrl('/api/data', folderPath, get().clientId), prevData);
    },

    setRefreshState: (isRefreshing, current, total) => {
      set((state) => {
        return {
          isRefreshing,
          refreshProgress: {
            current: current !== undefined ? current : state.refreshProgress.current,
            total: total !== undefined ? total : state.refreshProgress.total,
          },
        };
      });
    },

    setCancelRefresh: (cancelRefresh) => {
      return set({ cancelRefresh });
    },

    fullRefresh: async () => {
      const { data, setRefreshState, setCancelRefresh, currentFolderPath, clientId } = get();
      if (!currentFolderPath) {
        return;
      }

      const episodes = data.episodes;
      const eventCount = episodes.reduce((acc, ep) => {
        return acc + ep.events.length;
      }, 0);
      const totalSteps = eventCount + 1;

      setRefreshState(true, 0, totalSteps);
      setCancelRefresh(false);

      const activeFilenames: string[] = [];
      let currentStep = 0;

      for (let i = 0; i < episodes.length; i++) {
        const episode = episodes[i];
        for (let j = 0; j < episode.events.length; j++) {
          if (get().cancelRefresh) {
            setRefreshState(false);
            return;
          }

          const event = episode.events[j];
          const epIdx = String(i + 1).padStart(2, '0');
          const evIdx = String(j + 1).padStart(2, '0');
          const filename = `${epIdx}_${evIdx}.jpg`;
          activeFilenames.push(filename);

          try {
            const svgString = renderEventToSvgString(event, data, i + 1);
            const jpegBase64 = await svgToJpeg(svgString);
            await saveEventImage(filename, jpegBase64, currentFolderPath, clientId);
          } catch (_e) {
            // Error logged via backend
          }

          currentStep++;
          setRefreshState(true, currentStep, totalSteps);
        }
      }

      if (!get().cancelRefresh) {
        await cleanupZombieImages(activeFilenames, currentFolderPath, clientId);
        currentStep++;
        setRefreshState(true, currentStep, totalSteps);
      }

      await new Promise((r) => {
        return setTimeout(r, REFRESH_DELAY_MS);
      });
      setRefreshState(false);
    },

    setInterrupted: (interrupted) => {
      return set({ isInterrupted: interrupted });
    },
  };
});

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 409) {
      useStore.getState().setInterrupted(true);
    }
    return Promise.reject(error);
  }
);
