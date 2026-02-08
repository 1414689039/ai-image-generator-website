import { create } from 'zustand'

interface GenerationStore {
  history: any[]
  isLoaded: boolean
  lastFetchTime: number
  setHistory: (history: any[] | ((prev: any[]) => any[])) => void
  setIsLoaded: (loaded: boolean) => void
  setLastFetchTime: (time: number) => void
  clearHistory: () => void
}

export const useGenerationStore = create<GenerationStore>((set) => ({
  history: [],
  isLoaded: false,
  lastFetchTime: 0,
  setHistory: (updater) => 
    set((state) => ({ 
      history: typeof updater === 'function' ? updater(state.history) : updater 
    })),
  setIsLoaded: (loaded) => set({ isLoaded: loaded }),
  setLastFetchTime: (time) => set({ lastFetchTime: time }),
  clearHistory: () => set({ history: [], isLoaded: false, lastFetchTime: 0 }),
}))
