/**
 * Canale review condiviso: un documento JSON per (projectId, taskInstanceId)
 * letto/scritto da Omnia e dalla pagina web esterna.
 */

import type { AIAgentLogicalStep, AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import type { AgentReviewAudience } from './reviewAudience';
import { normalizeReviewAudience } from './reviewAudience';
import { serializeAgentUseCaseBundle, parseAgentUseCaseBundleDocument } from '../usecase/bundle/parseSerializeBundle';
import { getScenarioText } from '../usecase/logic/scenarioText';
import {
  AGENT_REVIEW_STRUCTURED_SECTION_IDS,
  type AgentStructuredSectionId,
} from '../task/sections/agentStructuredSectionIds';
import type {
  AgentReviewBackendSnapshot,
  AgentReviewConversationSnapshot,
  AgentReviewKnowledgeBaseSnapshot,
} from './reviewSnapshots';
import {
  parseBackendSnapshot,
  parseConversationSnapshot,
  parseKnowledgeBaseSnapshot,
} from './reviewSnapshots';

export type AgentReviewStructuredSections = Partial<
  Record<AgentStructuredSectionId, string>
>;

/** Effective section bodies for review publish (non-empty only). */
export function pickReviewStructuredSections(
  effectiveBySection: AgentReviewStructuredSections
): AgentReviewStructuredSections | undefined {
  const out: AgentReviewStructuredSections = {};
  let hasAny = false;
  for (const id of AGENT_REVIEW_STRUCTURED_SECTION_IDS) {
    const text = effectiveBySection[id]?.trim();
    if (text) {
      out[id] = text;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

export const AGENT_REVIEW_EXPORT_VERSION = 1 as const;

/** Modello LLM designer pubblicato da Omnia (motore per polish / bundle nel portale). */
export interface AgentReviewDesignerLlmSnapshot {
  provider: 'groq' | 'openai';
  model: string;
}

export function parseDesignerLlmSnapshot(
  raw: unknown
): AgentReviewDesignerLlmSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const provider = o.provider === 'openai' || o.provider === 'groq' ? o.provider : null;
  const model = typeof o.model === 'string' ? o.model.trim() : '';
  if (!provider || !model) return undefined;
  return { provider, model };
}

export interface AgentReviewChannelDocument {
  reviewExportVersion: typeof AGENT_REVIEW_EXPORT_VERSION;
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  agentDesignDescription: string;
  /** Bundle v3 serializzato come oggetto (non stringa). */
  useCaseBundle: {
    useCaseBundleSchemaVersion: number;
    categories: AIAgentUseCaseCategory[];
    use_cases: AIAgentUseCase[];
  };
  updatedAt: string;
  /** SHA-256 hex del payload canonico (per confronto rapido). */
  contentHash: string;
  /** Destinatario review (customer / internal / auditing). */
  reviewAudience?: AgentReviewAudience;
  /** Passi logici narrativi del task (opzionale, estensione publish). */
  agentLogicalSteps?: AIAgentLogicalStep[];
  /** Testo effettivo sezioni strutturate (Scopo, Sequenza, Contesto, Vincoli) per review read-only. */
  agentStructuredSections?: AgentReviewStructuredSections;
  /** Snapshot documenti Knowledge Base al momento del publish. */
  knowledgeBase?: AgentReviewKnowledgeBaseSnapshot;
  /** Snapshot backend collegati al task al momento del publish. */
  backends?: AgentReviewBackendSnapshot;
  /** Snapshot stile conversazione e regole al momento del publish. */
  conversation?: AgentReviewConversationSnapshot;
  /** Modello LLM designer usato in Omnia al publish (portale review lo applica al load). */
  designerLlm?: AgentReviewDesignerLlmSnapshot;
  /** Stato wizard use case (passo pipeline, baselines, conversazioni) serializzato come sul Task. */
  agentUseCaseWizardStateJson?: string;
}

export interface BuildReviewDocumentParams {
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  agentDesignDescription: string;
  useCases: readonly AIAgentUseCase[];
  categories: readonly AIAgentUseCaseCategory[];
  reviewAudience?: AgentReviewAudience;
  logicalSteps?: readonly AIAgentLogicalStep[];
  structuredSections?: AgentReviewStructuredSections;
  knowledgeBase?: AgentReviewKnowledgeBaseSnapshot;
  backends?: AgentReviewBackendSnapshot;
  conversation?: AgentReviewConversationSnapshot;
  designerLlm?: AgentReviewDesignerLlmSnapshot;
  agentUseCaseWizardStateJson?: string;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function canonicalReviewPayload(
  doc: Pick<
    AgentReviewChannelDocument,
    'agentDesignDescription' | 'useCaseBundle' | 'agentStructuredSections'
  >
) {
  const payload: {
    agentDesignDescription: string;
    useCaseBundle: AgentReviewChannelDocument['useCaseBundle'];
    agentStructuredSections?: AgentReviewStructuredSections;
  } = {
    agentDesignDescription: doc.agentDesignDescription.trim(),
    useCaseBundle: doc.useCaseBundle,
  };
  if (doc.agentStructuredSections && Object.keys(doc.agentStructuredSections).length > 0) {
    payload.agentStructuredSections = doc.agentStructuredSections;
  }
  return payload;
}

export function computeReviewContentHash(
  payload: ReturnType<typeof canonicalReviewPayload>
): string {
  const text = stableStringify(payload);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return hashSyncBrowser(text);
  }
  return hashSyncSimple(text);
}

function hashSyncSimple(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `fnv1a-${(h >>> 0).toString(16)}-${text.length}`;
}

function hashSyncBrowser(text: string): string {
  return hashSyncSimple(text);
}

export async function computeReviewContentHashAsync(
  payload: ReturnType<typeof canonicalReviewPayload>
): Promise<string> {
  const text = stableStringify(payload);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const buf = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return hashSyncSimple(text);
}

export function buildAgentReviewDocument(params: BuildReviewDocumentParams): AgentReviewChannelDocument {
  const bundleJson = serializeAgentUseCaseBundle(params.useCases, params.categories);
  const parsed = JSON.parse(bundleJson) as AgentReviewChannelDocument['useCaseBundle'];
  const useCaseBundle = {
    useCaseBundleSchemaVersion: parsed.useCaseBundleSchemaVersion,
    categories: parsed.categories ?? [],
    use_cases: parsed.use_cases ?? [],
  };
  const agentDesignDescription = params.agentDesignDescription ?? '';
  const structuredSections = pickReviewStructuredSections(params.structuredSections ?? {});
  const payload = canonicalReviewPayload({
    agentDesignDescription,
    useCaseBundle,
    agentStructuredSections: structuredSections,
  });
  const doc: AgentReviewChannelDocument = {
    reviewExportVersion: AGENT_REVIEW_EXPORT_VERSION,
    projectId: params.projectId.trim(),
    taskInstanceId: params.taskInstanceId.trim(),
    taskLabel: params.taskLabel.trim(),
    agentDesignDescription,
    useCaseBundle,
    updatedAt: new Date().toISOString(),
    contentHash: computeReviewContentHash(payload),
  };
  if (structuredSections) {
    doc.agentStructuredSections = structuredSections;
  }
  if (params.reviewAudience) {
    doc.reviewAudience = params.reviewAudience;
  }
  if (params.logicalSteps && params.logicalSteps.length > 0) {
    doc.agentLogicalSteps = [...params.logicalSteps];
  }
  if (params.knowledgeBase?.documents.length) {
    doc.knowledgeBase = params.knowledgeBase;
  }
  if (params.backends) {
    doc.backends = params.backends;
  }
  if (params.conversation) {
    doc.conversation = params.conversation;
  }
  if (params.designerLlm?.model?.trim()) {
    doc.designerLlm = {
      provider: params.designerLlm.provider,
      model: params.designerLlm.model.trim(),
    };
  }
  const wizardJson =
    typeof params.agentUseCaseWizardStateJson === 'string'
      ? params.agentUseCaseWizardStateJson.trim()
      : '';
  if (wizardJson) {
    doc.agentUseCaseWizardStateJson = wizardJson;
  }
  return doc;
}

export function parseAgentReviewDocument(raw: unknown): AgentReviewChannelDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.reviewExportVersion !== AGENT_REVIEW_EXPORT_VERSION) return null;
  const projectId = typeof o.projectId === 'string' ? o.projectId.trim() : '';
  const taskInstanceId = typeof o.taskInstanceId === 'string' ? o.taskInstanceId.trim() : '';
  if (!projectId || !taskInstanceId) return null;
  const bundle = o.useCaseBundle;
  if (!bundle || typeof bundle !== 'object') return null;
  const b = bundle as Record<string, unknown>;
  if (!Array.isArray(b.use_cases)) return null;
  const { useCases, categories } = parseAgentUseCaseBundleDocument(
    JSON.stringify(bundle)
  );
  const agentDesignDescription =
    typeof o.agentDesignDescription === 'string' ? o.agentDesignDescription : '';
  const useCaseBundle = {
    useCaseBundleSchemaVersion:
      typeof b.useCaseBundleSchemaVersion === 'number' ? b.useCaseBundleSchemaVersion : 3,
    categories: [...categories],
    use_cases: [...useCases],
  };
  const payload = canonicalReviewPayload({
    agentDesignDescription,
    useCaseBundle,
    agentStructuredSections: parseStructuredSectionsField(o.agentStructuredSections),
  });
  const contentHash =
    typeof o.contentHash === 'string' && o.contentHash.trim()
      ? o.contentHash.trim()
      : computeReviewContentHash(payload);
  const logicalRaw = o.agentLogicalSteps;
  const agentLogicalSteps = Array.isArray(logicalRaw)
    ? logicalRaw.filter(
        (s): s is AIAgentLogicalStep =>
          s != null &&
          typeof s === 'object' &&
          typeof (s as AIAgentLogicalStep).id === 'string' &&
          typeof (s as AIAgentLogicalStep).description === 'string'
      )
    : undefined;

  const doc: AgentReviewChannelDocument = {
    reviewExportVersion: AGENT_REVIEW_EXPORT_VERSION,
    projectId,
    taskInstanceId,
    taskLabel: typeof o.taskLabel === 'string' ? o.taskLabel : '',
    agentDesignDescription,
    useCaseBundle,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString(),
    contentHash,
    reviewAudience: normalizeReviewAudience(o.reviewAudience),
  };
  if (agentLogicalSteps && agentLogicalSteps.length > 0) {
    doc.agentLogicalSteps = agentLogicalSteps;
  }
  const structuredSections = parseStructuredSectionsField(o.agentStructuredSections);
  if (structuredSections) {
    doc.agentStructuredSections = structuredSections;
  }
  const knowledgeBase = parseKnowledgeBaseSnapshot(o.knowledgeBase);
  if (knowledgeBase) {
    doc.knowledgeBase = knowledgeBase;
  }
  const backends = parseBackendSnapshot(o.backends);
  if (backends) {
    doc.backends = backends;
  }
  const conversation = parseConversationSnapshot(o.conversation);
  if (conversation) {
    doc.conversation = conversation;
  }
  const designerLlm = parseDesignerLlmSnapshot(o.designerLlm);
  if (designerLlm) {
    doc.designerLlm = designerLlm;
  }
  const wizardJson =
    typeof o.agentUseCaseWizardStateJson === 'string' ? o.agentUseCaseWizardStateJson.trim() : '';
  if (wizardJson) {
    doc.agentUseCaseWizardStateJson = wizardJson;
  }
  return doc;
}

function parseStructuredSectionsField(raw: unknown): AgentReviewStructuredSections | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: AgentReviewStructuredSections = {};
  let hasAny = false;
  for (const id of AGENT_REVIEW_STRUCTURED_SECTION_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'string' && v.trim()) {
      out[id] = v;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

export interface ReviewChannelDiffSummary {
  descriptionChanged: boolean;
  useCasesChanged: boolean;
  modifiedScenarioCount: number;
  voteChanges: number;
}

export function summarizeReviewDiff(
  local: BuildReviewDocumentParams,
  remote: AgentReviewChannelDocument
): ReviewChannelDiffSummary {
  const localDoc = buildAgentReviewDocument(local);
  const descriptionChanged =
    localDoc.agentDesignDescription.trim() !== remote.agentDesignDescription.trim();
  const useCasesChanged = localDoc.contentHash !== remote.contentHash;

  let modifiedScenarioCount = 0;
  let voteChanges = 0;
  const remoteById = new Map(remote.useCaseBundle.use_cases.map((u) => [u.id, u]));
  for (const lu of localDoc.useCaseBundle.use_cases) {
    const ru = remoteById.get(lu.id);
    if (!ru) {
      modifiedScenarioCount += 1;
      continue;
    }
    if (getScenarioText(lu).trim() !== getScenarioText(ru).trim()) modifiedScenarioCount += 1;
    const votes: Array<'designer_label_vote' | 'designer_payoff_vote' | 'designer_agent_message_vote'> = [
      'designer_label_vote',
      'designer_payoff_vote',
      'designer_agent_message_vote',
    ];
    for (const k of votes) {
      if (lu[k] !== ru[k]) voteChanges += 1;
    }
  }
  for (const ru of remote.useCaseBundle.use_cases) {
    if (!localDoc.useCaseBundle.use_cases.some((u) => u.id === ru.id)) modifiedScenarioCount += 1;
  }

  return {
    descriptionChanged,
    useCasesChanged,
    modifiedScenarioCount,
    voteChanges,
  };
}
