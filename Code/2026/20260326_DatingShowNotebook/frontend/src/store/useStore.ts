import { create } from 'zustand';
import axios from 'axios';
import { renderEventToSvgString } from '../utils/svgRenderer';
import { svgToJpeg, saveEventImage, cleanupZombieImages } from '../utils/imageGen';

export type Gender = 'male' | 'female';
export type MessageType = 'strong' | 'weak';

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
  refreshProgress: { current: number; total: number };
  cancelRefresh: boolean;

  clientId: string;
  currentFolderPath: string | null;
  recentFolders: string[];
  isInterrupted: boolean;

  openFolder: (path: string) => Promise<void>;
  saveData: (newData: AppData) => Promise<void>;
  setActiveMode: (mode: ActiveMode) => void;
  setSelectedView: (episodeId: number | null, eventId: number | null) => void;
  setBodyScale: (scale: number) => void;
  setDescriptionScale: (scale: number) => void;
  undo: () => void;
  setRefreshState: (isRefreshing: boolean, current?: number, total?: number) => void;
  setCancelRefresh: (cancel: boolean) => void;
  fullRefresh: () => Promise<void>;
  setInterrupted: (interrupted: boolean) => void;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};
const CLIENT_ID = generateId();

const savedRecent = localStorage.getItem('dsn_recent_folders');
const initialRecent = savedRecent ? JSON.parse(savedRecent) : [];

export const useStore = create<AppState>((set, get) => ({
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
  refreshProgress: { current: 0, total: 0 },
  cancelRefresh: false,

  clientId: CLIENT_ID,
  currentFolderPath: null,
  recentFolders: initialRecent,
  isInterrupted: false,

  openFolder: async (folderPath) => {
    const clientId = get().clientId;
    const res = await axios.post('/api/open', { path: folderPath, clientId });
    let data: AppData = res.data;

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
          .map((m) => ({
            ...m,
            from: personMap.get(m.from)!,
            to: personMap.get(m.to)!,
          }))
          .filter((m) => {
            if (!m.from || !m.to || !validPersonIds.has(m.from) || !validPersonIds.has(m.to)) {
              return false;
            }
            const key = `${m.from}-${m.to}-${m.type}`;
            if (seenMessages.has(key)) return false;
            seenMessages.add(key);
            return true;
          });

        const cleanedTeams: { [teamIndex: string]: number[] } = {};
        Object.entries(ev.teams).forEach(([idx, members]) => {
          const validMembers = members
            .map((id) => personMap.get(id)!)
            .filter((id) => id && validPersonIds.has(id));
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

    const newRecent = [folderPath, ...get().recentFolders.filter((p) => p !== folderPath)].slice(0, 10);
    localStorage.setItem('dsn_recent_folders', JSON.stringify(newRecent));

    await new Promise((r) => setTimeout(r, 1000));

    set({
      data,
      currentFolderPath: folderPath,
      selectedEpisodeId: lastEpisodeId,
      selectedEventId: lastEventId,
      activeMode: 'message',
      recentFolders: newRecent,
      undoStack: [],
    });

    await axios.post('/api/data', data, {
      headers: {
        'x-folder-path': folderPath,
        'x-client-id': clientId
      }
    });
  },

  saveData: async (newData) => {
    const folderPath = get().currentFolderPath;
    const clientId = get().clientId;
    if (!folderPath) return;

    const currentData = get().data;
    set({
      undoStack: [JSON.parse(JSON.stringify(currentData)), ...get().undoStack].slice(0, 50),
      data: newData,
    });
    
    await axios.post('/api/data', newData, {
      headers: {
        'x-folder-path': folderPath,
        'x-client-id': clientId
      }
    });
  },

  setActiveMode: (mode) => set({ activeMode: mode }),

  setSelectedView: (episodeId, eventId) =>
    set({
      selectedEpisodeId: episodeId,
      selectedEventId: eventId,
      activeMode: 'message',
    }),

  setBodyScale: (scale) => {
    const newData = { ...get().data, bodyScale: scale };
    get().saveData(newData);
  },

  setDescriptionScale: (scale) => {
    const newData = { ...get().data, descriptionScale: scale };
    get().saveData(newData);
  },

  undo: () => {
    const folderPath = get().currentFolderPath;
    const clientId = get().clientId;
    if (!folderPath) return;

    const stack = get().undoStack;
    if (stack.length === 0) return;
    const [prevData, ...remainingStack] = stack;
    set({
      data: prevData,
      undoStack: remainingStack,
    });
    
    axios.post('/api/data', prevData, {
      headers: {
        'x-folder-path': folderPath,
        'x-client-id': clientId
      }
    });
  },

  setRefreshState: (isRefreshing, current, total) => {
    set((state) => ({
      isRefreshing,
      refreshProgress: {
        current: current !== undefined ? current : state.refreshProgress.current,
        total: total !== undefined ? total : state.refreshProgress.total,
      },
    }));
  },

  setCancelRefresh: (cancelRefresh) => set({ cancelRefresh }),

  fullRefresh: async () => {
    const { data, setRefreshState, setCancelRefresh, currentFolderPath, clientId } = get();
    if (!currentFolderPath) return;

    const episodes = data.episodes;
    const eventCount = episodes.reduce((acc, ep) => acc + ep.events.length, 0);
    const totalSteps = eventCount + 1;

    setRefreshState(true, 0, totalSteps);
    setCancelRefresh(false);

    const activeFilenames: string[] = [];
    let currentStep = 0;

    const config = {
      headers: {
        'x-folder-path': currentFolderPath,
        'x-client-id': clientId
      }
    };

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
          await saveEventImage(filename, jpegBase64, config);
        } catch (e) {
          // Error logged via backend
        }

        currentStep++;
        setRefreshState(true, currentStep, totalSteps);
      }
    }

    if (!get().cancelRefresh) {
      await cleanupZombieImages(activeFilenames, config);
      currentStep++;
      setRefreshState(true, currentStep, totalSteps);
    }

    await new Promise((r) => setTimeout(r, 300));
    setRefreshState(false);
  },

  setInterrupted: (interrupted) => set({ isInterrupted: interrupted }),
}));

axios.interceptors.request.use((config) => {
  const state = useStore.getState();
  if (state.currentFolderPath !== null && state.clientId) {
    if (!config.headers['x-folder-path']) {
      config.headers['x-folder-path'] = state.currentFolderPath;
    }
    if (!config.headers['x-client-id']) {
      config.headers['x-client-id'] = state.clientId;
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 409) {
      useStore.getState().setInterrupted(true);
    }
    return Promise.reject(error);
  }
);
