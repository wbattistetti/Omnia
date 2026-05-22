/**
 * Canale review condiviso: un documento JSON per (projectId, taskInstanceId)
 * letto/scritto da Omnia e dalla pagina web esterna.
 */

import type { AIAgentLogicalStep, AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import type { AgentReviewAudience } from './reviewAudience';
import { normalizeReviewAudience } from './reviewAudience';
import { serializeAgentUseCaseBundle, parseAgentUseCaseBundleDocument } from '@domain/useCaseBundle/parseSerializeBundle';
import { getScenarioText } from '@domain/aiAgentUseCase/scenarioText';

export const AGENT_REVIEW_EXPORT_VERSION = 1 as const;

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
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

/** Payload usato per hash e diff (ordine stabile). */
export function canonicalReviewPayload(doc: Pick<AgentReviewChannelDocument, 'agentDesignDescription' | 'useCaseBundle'>) {
  return {
    agentDesignDescription: doc.agentDesignDescription.trim(),
    useCaseBundle: doc.useCaseBundle,
  };
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
  const payload = canonicalReviewPayload({ agentDesignDescription, useCaseBundle });
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
  if (params.reviewAudience) {
    doc.reviewAudience = params.reviewAudience;
  }
  if (params.logicalSteps && params.logicalSteps.length > 0) {
    doc.agentLogicalSteps = [...params.logicalSteps];
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
  const payload = canonicalReviewPayload({ agentDesignDescription, useCaseBundle });
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
  return doc;
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
