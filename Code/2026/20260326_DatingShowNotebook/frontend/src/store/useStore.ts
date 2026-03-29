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

  /**
   * Fetches application data from the server and performs initialization tasks
   * like ID compaction, data cleaning, and setting the initial view.
   */
  fetchData: async () => {
    const res = await axios.get('/api/data');
    let data: AppData = res.data;

    // --- Round 1: Build ID Mapping & Determine nextUniqueId ---
    const personMap = new Map<number, number>();
    const episodeMap = new Map<number, number>();
    const eventMap = new Map<number, number>();
    let nextId = 1;

    // Map Person IDs
    data.people.forEach((p) => {
      personMap.set(p.id, nextId++);
    });

    // Map Episode and Event IDs
    data.episodes.forEach((ep) => {
      episodeMap.set(ep.id, nextId++);
      ep.events.forEach((ev) => {
        eventMap.set(ev.id, nextId++);
      });
    });

    // Set the next global unique ID
    data.nextUniqueId = nextId;

    // --- Round 2: Apply Mappings & Clean Up Data ---
    const validPersonIds = new Set(personMap.values());

    // Update People
    data.people.forEach((p) => {
      p.id = personMap.get(p.id)!;
    });

    // Update Episodes, Events, and Clean References
    data.episodes.forEach((ep) => {
      ep.id = episodeMap.get(ep.id)!;

      ep.events.forEach((ev) => {
        ev.id = eventMap.get(ev.id)!;

        // Clean messages: Update IDs, remove dangling/invalid, remove duplicates
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

        // Clean teams: Update IDs, remove dangling, remove duplicates, remove empty teams
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

    // Default view: last event of last episode
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

  /**
   * Persists application data to the server and updates the local state.
   * Maintains an undo stack for quick recovery of previous states.
   */
  saveData: async (newData) => {
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

  /**
   * Reverts the application data to the most recent state in the undo stack.
   */
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
