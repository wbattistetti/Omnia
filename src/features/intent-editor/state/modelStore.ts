import { create } from 'zustand';
import { TrainConfig } from '../types/types';

type ModelState = {
  cfg: TrainConfig;
  training: boolean;
  modelId?: string;
  setCfg: (upd: Partial<TrainConfig>) => void;
  setTraining: (b: boolean) => void;
  setModelId: (id?: string) => void;
};

export const useModelStore = create<ModelState>((set) => ({
  cfg: { alpha: 0.5, topK: 5, globalThreshold: 0.55, entropyMax: 0.15 },
  training: false,
  setCfg: (upd) => set(s=>({ cfg: { ...s.cfg, ...upd } })),
  setTraining: (b) => set({ training: b }),
  setModelId: (id) => set({ modelId: id })
}));


