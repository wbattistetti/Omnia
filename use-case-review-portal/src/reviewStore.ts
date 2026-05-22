/**
 * Stato review: lista canali, sessione attiva, use case selezionato, autosave server.
 */

import type React from 'react';
import { create } from 'zustand';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import type { AgentReviewStructuredSections } from '@domain/agentReviewChannel/reviewDocument';
import type { AgentStructuredSectionId } from '@omnia/domain-core/task/sections/agentStructuredSectionIds';
import type {
  AgentReviewBackendSnapshot,
  AgentReviewConversationSnapshot,
  AgentReviewKnowledgeBaseSnapshot,
} from '@domain/agentReviewChannel/reviewSnapshots';
import {
  buildAgentReviewDocument,
  computeReviewContentHashAsync,
  canonicalReviewPayload,
} from '@domain/agentReviewChannel/reviewDocument';
import {
  fetchAgentReviewChannel,
  listReviewChannels,
  saveAgentReviewChannel,
  type ReviewChannelListItem,
} from '@services/agentReviewChannelApi';
import { reviewApiBase } from './reviewConfig';
import { reviewAuthToken } from './reviewAuth';

const LS_PREFIX = 'omnia-review-draft:';

export interface ReviewSession {
  projectId: string;
  taskId: string;
  taskLabel: string;
  projectLabel: string;
}

interface ReviewState {
  catalog: ReviewChannelListItem[];
  catalogLoading: boolean;
  catalogError: string | null;
  session: ReviewSession | null;
  selectedUseCaseId: string | null;
  description: string;
  structuredSections: AgentReviewStructuredSections;
  knowledgeBase: AgentReviewKnowledgeBaseSnapshot | null;
  backends: AgentReviewBackendSnapshot | null;
  conversation: AgentReviewConversationSnapshot | null;
  useCases: AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
  baselinesByUseCaseId: Record<string, { payoff: string }>;
  status: string;
  saving: boolean;
  lastSavedAt: string | null;
  /** True dopo il primo load canale (evita PUT con stato vuoto prima del fetch). */
  channelLoaded: boolean;
  loadCatalog: () => Promise<void>;
  openSession: (item: ReviewChannelListItem) => void;
  closeSession: () => void;
  setSelectedUseCaseId: (id: string | null) => void;
  setDescription: (text: string) => void;
  setStructuredSection: (sectionId: AgentStructuredSectionId, text: string) => void;
  setConversationStyleLearningNotes: (notes: string) => void;
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  setCategories: React.Dispatch<React.SetStateAction<AIAgentUseCaseCategory[]>>;
  updateUseCase: (id: string, patch: Partial<AIAgentUseCase>) => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

function lsKey(projectId: string, taskId: string): string {
  return `${LS_PREFIX}${projectId}:${taskId}`;
}

function captureBaselines(useCases: readonly AIAgentUseCase[]): Record<string, { payoff: string }> {
  const out: Record<string, { payoff: string }> = {};
  for (const u of useCases) {
    out[u.id] = { payoff: u.payoff ?? u.scenario?.llm ?? '' };
  }
  return out;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  catalog: [],
  catalogLoading: false,
  catalogError: null,
  session: null,
  selectedUseCaseId: null,
  description: '',
  structuredSections: {},
  knowledgeBase: null,
  backends: null,
  conversation: null,
  useCases: [],
  categories: [],
  baselinesByUseCaseId: {},
  status: '',
  saving: false,
  lastSavedAt: null,
  channelLoaded: false,

  loadCatalog: async () => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const items = await listReviewChannels({
        token: reviewAuthToken(),
        apiBase: reviewApiBase(),
      });
      set({ catalog: items, catalogLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let hint = '';
      if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('500')) {
        hint = ' — Verifica che il backend sia online (npm run dev:beNew o npm run be:express).';
      } else if (msg.includes('401') && msg.includes('review_token_invalid')) {
        hint = ' — Avvia il backend Omnia (npm run dev:beNew) e riprova.';
      }
      set({
        catalogLoading: false,
        catalogError: `${msg}${hint}`,
      });
    }
  },

  openSession: (item) => {
    set({
      session: {
        projectId: item.projectId,
        taskId: item.taskInstanceId,
        taskLabel: item.taskLabel,
        projectLabel: item.projectLabel,
      },
      selectedUseCaseId: null,
      description: '',
      structuredSections: {},
      knowledgeBase: null,
      backends: null,
      conversation: null,
      useCases: [],
      categories: [],
      baselinesByUseCaseId: {},
      status: '',
      channelLoaded: false,
    });
    void get().loadFromServer();
  },

  closeSession: () =>
    set({
      session: null,
      selectedUseCaseId: null,
      useCases: [],
      categories: [],
      description: '',
      structuredSections: {},
      knowledgeBase: null,
      backends: null,
      conversation: null,
      status: '',
      channelLoaded: false,
    }),

  setSelectedUseCaseId: (id) => set({ selectedUseCaseId: id }),

  setDescription: (text) => set({ description: text }),

  setStructuredSection: (sectionId, text) =>
    set((s) => ({
      structuredSections: { ...s.structuredSections, [sectionId]: text },
    })),

  setConversationStyleLearningNotes: (notes) =>
    set((s) => ({
      conversation: s.conversation
        ? { ...s.conversation, styleLearningNotes: notes }
        : {
            conversationalRules: [],
            styleAuto: false,
            styleSelections: {},
            globalStyleId: '',
            styleLearningNotes: notes,
            deployStyleId: null,
          },
    })),

  setUseCases: (next) =>
    set((s) => ({
      useCases: typeof next === 'function' ? next(s.useCases) : [...next],
    })),

  setCategories: (next) =>
    set((s) => ({
      categories: typeof next === 'function' ? next(s.categories) : [...next],
    })),

  updateUseCase: (id, patch) =>
    set((s) => ({
      useCases: s.useCases.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    })),

  loadFromServer: async () => {
    const session = get().session;
    if (!session) return;
    set({ status: 'Caricamento…' });
    try {
      const { document: doc } = await fetchAgentReviewChannel({
        projectId: session.projectId,
        taskInstanceId: session.taskId,
        token: reviewAuthToken(),
        apiBase: reviewApiBase(),
      });
      if (doc) {
        const useCases = [...doc.useCaseBundle.use_cases];
        set({
          description: doc.agentDesignDescription,
          structuredSections: { ...(doc.agentStructuredSections ?? {}) },
          knowledgeBase: doc.knowledgeBase ?? null,
          backends: doc.backends ?? null,
          conversation: doc.conversation ?? null,
          useCases,
          categories: [...doc.useCaseBundle.categories],
          baselinesByUseCaseId: captureBaselines(useCases),
          selectedUseCaseId: useCases[0]?.id ?? null,
          status: '',
          channelLoaded: true,
        });
        try {
          localStorage.setItem(lsKey(session.projectId, session.taskId), JSON.stringify(doc));
        } catch {
          /* ignore */
        }
        return;
      }
      const raw = localStorage.getItem(lsKey(session.projectId, session.taskId));
      if (raw) {
        const { parseAgentReviewDocument } = await import('@domain/agentReviewChannel/reviewDocument');
        const parsed = parseAgentReviewDocument(JSON.parse(raw));
        if (parsed) {
          const useCases = [...parsed.useCaseBundle.use_cases];
          set({
            description: parsed.agentDesignDescription,
            structuredSections: { ...(parsed.agentStructuredSections ?? {}) },
            knowledgeBase: parsed.knowledgeBase ?? null,
            backends: parsed.backends ?? null,
            conversation: parsed.conversation ?? null,
            useCases,
            categories: [...parsed.useCaseBundle.categories],
            baselinesByUseCaseId: captureBaselines(useCases),
            selectedUseCaseId: useCases[0]?.id ?? null,
            status: 'Bozza locale (canale vuoto sul server).',
            channelLoaded: true,
          });
          return;
        }
      }
      set({ status: 'Nessuna review pubblicata per questo task. Pubblica da Omnia.', channelLoaded: true });
    } catch (e) {
      set({ status: e instanceof Error ? e.message : String(e) });
    }
  },

  saveToServer: async () => {
    const session = get().session;
    if (!session) return;
    if (!get().channelLoaded) return;
    const {
      description,
      useCases,
      categories,
      structuredSections,
      knowledgeBase,
      backends,
      conversation,
    } = get();
    set({ saving: true });
    try {
      let doc = buildAgentReviewDocument({
        projectId: session.projectId,
        taskInstanceId: session.taskId,
        taskLabel: session.taskLabel,
        agentDesignDescription: description,
        useCases,
        categories,
        structuredSections,
        ...(knowledgeBase ? { knowledgeBase } : {}),
        ...(backends ? { backends } : {}),
        ...(conversation ? { conversation } : {}),
      });
      const payload = canonicalReviewPayload(doc);
      doc = { ...doc, contentHash: await computeReviewContentHashAsync(payload) };
      await saveAgentReviewChannel({
        projectId: session.projectId,
        taskInstanceId: session.taskId,
        document: doc,
        token: reviewAuthToken(),
        apiBase: reviewApiBase(),
        source: 'portal',
      });
      try {
        localStorage.setItem(lsKey(session.projectId, session.taskId), JSON.stringify(doc));
      } catch {
        /* ignore */
      }
      set({
        saving: false,
        lastSavedAt: new Date().toISOString(),
        status: 'Salvato sul canale condiviso.',
      });
    } catch (e) {
      set({
        saving: false,
        status: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));
