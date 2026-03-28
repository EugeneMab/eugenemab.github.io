import { create } from 'zustand';
import axios from 'axios';

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
  id: string;
  title: string;
  messages: Message[];
  teams: { [teamIndex: string]: number[] };
}

export interface Episode {
  id: number;
  events: Event[];
}

export interface AppData {
  people: Person[];
  episodes: Episode[];
  nextPersonId: number;
  bodyScale: number;
  descriptionScale: number;
}

export type ActiveMode = 'select' | 'message' | 'weak-message' | 'team-0' | 'team-1' | 'team-2' | 'team-3' | 'team-4';

interface AppState {
  data: AppData;
  activeMode: ActiveMode;
  selectedEpisodeId: number | null; // null means Person View
  selectedEventId: string | null;
  undoStack: AppData[];

  fetchData: () => Promise<void>;
  saveData: (newData: AppData) => Promise<void>;
  setActiveMode: (mode: ActiveMode) => void;
  setSelectedView: (episodeId: number | null, eventId: string | null) => void;
  setBodyScale: (scale: number) => void;
  setDescriptionScale: (scale: number) => void;
  undo: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  data: {
    people: [],
    episodes: [],
    nextPersonId: 1,
    bodyScale: 1,
    descriptionScale: 1
  },
  activeMode: 'select',
  selectedEpisodeId: 1,
  selectedEventId: '1-1',
  undoStack: [],

  fetchData: async () => {
    const res = await axios.get('/api/data');
    set({ data: res.data });
  },

  saveData: async (newData) => {
    // Save to undo stack before updating
    const currentData = get().data;
    set({
      undoStack: [JSON.parse(JSON.stringify(currentData)), ...get().undoStack].slice(0, 50),
      data: newData
    });
    await axios.post('/api/data', newData);
  },

  setActiveMode: (mode) => set({ activeMode: mode }),

  setSelectedView: (episodeId, eventId) => set({
    selectedEpisodeId: episodeId,
    selectedEventId: eventId,
    activeMode: 'select'
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
      undoStack: remainingStack
    });
    axios.post('/api/data', prevData);
  }
}));
