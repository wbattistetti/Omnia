import { create } from 'zustand';
import { Intent, Variant, Lang } from '../types/types';
import { normalizeName } from '../utils/normalize';

type IntentState = {
  intents: Intent[];
  selectedId?: string;
  select: (id?: string) => void;
  addIntent: (name: string, langs: Lang[]) => string;
  addStaging: (id: string, vs: Variant[]) => void;
  promoteToCurated: (id: string, variantIds: string[]) => void;
  addHardNeg: (id: string, v: Variant) => void;
  updateSignals: (id: string, fn: (s: Intent['signals']) => Intent['signals']) => void;
  setThreshold: (id: string, thr: number) => void;
  findByName: (name: string) => string | undefined;
  addOrFocusIntent: (name: string, langs?: Lang[]) => string;
  addCurated: (id: string, text: string, lang?: Lang) => void;
  addKeyword: (id: string, term: string, weight?: number) => void;
};

export const useIntentStore = create<IntentState>((set, get) => ({
  intents: [],
  select: (id) => set({ selectedId: id }),
  addIntent: (name, langs) => {
    const id = crypto.randomUUID();
    const it: Intent = {
      id, name, langs, threshold: 0.6, status: 'draft',
      variants: { curated: [], staging: [], hardNeg: [] },
      signals: { keywords: [], synonymSets: [], patterns: [] },
    };
    set(s => ({ intents: [it, ...s.intents], selectedId: id }));
    return id;
  },
  addStaging: (id, vs) => set(s => ({
    intents: s.intents.map(it => it.id === id ? { ...it, variants: { ...it.variants, staging: [...it.variants.staging, ...vs] } } : it)
  })),
  promoteToCurated: (id, vids) => set(s => ({
    intents: s.intents.map(it => {
      if (it.id !== id) return it;
      const sel = new Set(vids);
      const promote = it.variants.staging.filter(v => sel.has(v.id));
      const rest = it.variants.staging.filter(v => !sel.has(v.id));
      return { ...it, variants: { curated: [...promote, ...it.variants.curated], staging: rest, hardNeg: it.variants.hardNeg } };
    })
  })),
  addHardNeg: (id, v) => set(s => ({
    intents: s.intents.map(it => it.id === id ? { ...it, variants: { ...it.variants, hardNeg: [v, ...it.variants.hardNeg] } } : it)
  })),
  updateSignals: (id, fn) => set(s => ({
    intents: s.intents.map(it => it.id === id ? { ...it, signals: fn(it.signals) } : it)
  })),
  setThreshold: (id, thr) => set(s => ({
    intents: s.intents.map(it => it.id === id ? { ...it, threshold: thr } : it)
  })),
  addCurated: (id, text, lang = 'it') => set(s => ({
    intents: s.intents.map(it => it.id === id ? {
      ...it,
      variants: { ...it.variants, curated: [ { id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2), text, lang }, ...it.variants.curated ] }
    } : it)
  })),
  addKeyword: (id, term, weight = 1) => set(s => ({
    intents: s.intents.map(it => it.id === id ? {
      ...it,
      signals: { ...it.signals, keywords: [ ...(it.signals.keywords || []), { t: term, w: weight } ] }
    } : it)
  })),
  findByName: (name) => {
    const n = normalizeName(name);
    const it = get().intents.find(x => normalizeName(x.name) === n);
    return it?.id;
  },
  addOrFocusIntent: (name, langs = ['it']) => {
    const idFound = get().findByName(name);
    if (idFound) { get().select(idFound); return idFound; }
    return get().addIntent(name, langs);
  },
}));


