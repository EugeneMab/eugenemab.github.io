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
  | 'eraser';

interface AppState {
  data: AppData;
  activeMode: ActiveMode;
  selectedEpisodeId: number | null; // null means Person View
  selectedEventId: number | null;
  undoStack: AppData[];

  isRefreshing: boolean;
  refreshProgress: { current: number; total: number };
  cancelRefresh: boolean;

  fetchData: () => Promise<void>;
  saveData: (newData: AppData) => Promise<void>;
  setActiveMode: (mode: ActiveMode) => void;
  setSelectedView: (episodeId: number | null, eventId: number | null) => void;
  setBodyScale: (scale: number) => void;
  setDescriptionScale: (scale: number) => void;
  undo: () => void;
  setRefreshState: (isRefreshing: boolean, current?: number, total?: number) => void;
  setCancelRefresh: (cancel: boolean) => void;
  fullRefresh: () => Promise<void>;
}

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

  fetchData: async () => {
    const res = await axios.get('/api/data');
    const data: AppData = res.data;

    // Focus on the last event of the last episode
    let lastEpisodeId = null;
    let lastEventId = null;
    if (data.episodes.length > 0) {
      const lastEpisode = data.episodes[data.episodes.length - 1];
      lastEpisodeId = lastEpisode.id;
      if (lastEpisode.events.length > 0) {
        lastEventId = lastEpisode.events[lastEpisode.events.length - 1].id;
      }
    }

    set({
      data,
      selectedEpisodeId: lastEpisodeId,
      selectedEventId: lastEventId,
      activeMode: 'message',
    });
  },

  saveData: async (newData) => {
    // Save to undo stack before updating
    const currentData = get().data;
    set({
      undoStack: [JSON.parse(JSON.stringify(currentData)), ...get().undoStack].slice(0, 50),
      data: newData,
    });
    await axios.post('/api/data', newData);
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
    const stack = get().undoStack;
    if (stack.length === 0) return;
    const [prevData, ...remainingStack] = stack;
    set({
      data: prevData,
      undoStack: remainingStack,
    });
    axios.post('/api/data', prevData);
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
    const { data, setRefreshState, setCancelRefresh } = get();
    const episodes = data.episodes;
    const eventCount = episodes.reduce((acc, ep) => acc + ep.events.length, 0);
    const totalSteps = eventCount + 1; // +1 for cleanup step

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
          await saveEventImage(filename, jpegBase64);
        } catch (e) {
          console.error(`Failed to generate image for ${filename}:`, e);
        }

        currentStep++;
        setRefreshState(true, currentStep, totalSteps);
      }
    }

    if (!get().cancelRefresh) {
      await cleanupZombieImages(activeFilenames);
      currentStep++;
      setRefreshState(true, currentStep, totalSteps);
    }

    // Small delay to let user see 100%
    await new Promise((r) => setTimeout(r, 300));
    setRefreshState(false);
  },
}));
