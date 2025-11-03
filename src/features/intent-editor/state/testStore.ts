import { create } from 'zustand';

export type TestItemStatus = 'unknown' | 'correct' | 'wrong';
export type TestItem = {
  id: string;
  text: string;
  status: TestItemStatus;
  fixIntentId?: string;
  note?: string;
  predictedIntentId?: string;
  score?: number;
};

type TestState = {
  items: TestItem[];
  add: (text: string) => void;
  remove: (id: string) => void;
  markCorrect: (id: string) => void;
  markWrong: (id: string) => void;
  setFixIntent: (id: string, intentId?: string) => void;
  setNote: (id: string, note: string) => void;
  setResult: (id: string, r: { predictedIntentId?: string; score?: number }) => void;
  updateText: (id: string, text: string) => void;
};

const norm = (s: string) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const useTestStore = create<TestState>((set, get) => ({
  items: [],
  add: (text) => set(s => {
    const exists = s.items.find(i => norm(i.text) === norm(text));
    if (exists) return s; // dedup
    const item: TestItem = { id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2), text, status: 'unknown' };
    return { items: [item, ...s.items] };
  }),
  remove: (id) => set(s => ({ items: s.items.filter(i => i.id !== id) })),
  markCorrect: (id) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, status: 'correct' } : i) })),
  markWrong: (id) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, status: 'wrong' } : i) })),
  setFixIntent: (id, intentId) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, fixIntentId: intentId } : i) })),
  setNote: (id, note) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, note } : i) })),
  setResult: (id, r) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, ...r } : i) })),
  updateText: (id, text) => set(s => ({
    items: s.items.map(i => i.id === id ? {
      ...i,
      text: text.trim(),
      status: 'unknown', // ✅ Reset status quando si modifica il testo
      predictedIntentId: undefined, // ✅ Reset predizione
      score: undefined // ✅ Reset score
    } : i)
  })),
}));


