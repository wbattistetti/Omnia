/**
 * Risolve testo runtime KB/backend: cache → euristica → distillazione estrema LLM.
 */

import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import { hashString } from '@domain/backendCatalog/hashString';
import { readAgentBackendAnalysisBundle } from '@domain/backendAnalysis/agentBackendAnalysisBundle';
import { buildBackendAnalysisContextBlock } from '@domain/backendAnalysis/backendAnalysisRuntimeSynthesis';
import type { AgentBackendAnalysisSnapshot } from '@domain/backendAnalysis/backendAnalysisTypes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  distillBackendAnalysisRuntime,
  distillKbDocumentAnalysisRuntime,
} from './analysisRuntimeDistillApi';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import type { KbDocumentPatch, StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';
import {
  distillKbDocumentAnalysisForRuntime,
  kbDocumentHasUsableAnalysis,
} from '@domain/knowledgeBase/kbAnalysisRuntimeSynthesis';

export type RuntimeDistillAiParams = {
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
  taskContext?: KbDocumentAnalysisTaskContext;
};

export type RuntimeDistillCallbacks = {
  applyKbDocumentPatch?: (docId: string, patch: KbDocumentPatch) => void;
  applyBackendAnalysisPatch?: (patch: Partial<AgentBackendAnalysisSnapshot>) => void;
};

export function computeRuntimeDistillSourceHash(heuristicInput: string): string {
  return hashString(heuristicInput.trim());
}

/** Invalida cache distillazione LLM dopo modifica analisi KB. */
export function clearKbRuntimeDistillCachePatch(): KbDocumentPatch {
  return {
    documentAnalysisRuntimeDistillMarkdown: undefined,
    documentAnalysisRuntimeDistillSourceHash: undefined,
  };
}

function clipRuntimeText(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}

function getCachedKbRuntimeDistill(
  doc: StagedKbDocument,
  sourceHash: string
): string | null {
  const cached = String(doc.documentAnalysisRuntimeDistillMarkdown ?? '').trim();
  const hash = String(doc.documentAnalysisRuntimeDistillSourceHash ?? '').trim();
  if (!cached || hash !== sourceHash) return null;
  return cached;
}

function getCachedBackendRuntimeDistill(
  snap: AgentBackendAnalysisSnapshot,
  sourceHash: string
): string | null {
  const cached = String(snap.runtimeDistilledMarkdown ?? '').trim();
  const hash = String(snap.runtimeDistillSourceHash ?? '').trim();
  if (!cached || hash !== sourceHash) return null;
  return cached;
}

export type ResolveKbRuntimeDistillResult = {
  text: string;
  usedLlmDistill: boolean;
  usedCache: boolean;
};

/**
 * Testo KB per use case / runtime: cache LLM, altrimenti chiamata distillazione, fallback euristico.
 */
export async function resolveKbRuntimeDistillText(
  doc: StagedKbDocument,
  perDocBudget: number,
  ai: RuntimeDistillAiParams | undefined,
  callbacks: RuntimeDistillCallbacks | undefined
): Promise<ResolveKbRuntimeDistillResult> {
  const raw = String(doc.documentAnalysisMarkdown ?? doc.markdownSnippet ?? '').trim();
  if (!raw) return { text: '', usedLlmDistill: false, usedCache: false };

  const heuristic = kbDocumentHasUsableAnalysis(doc)
    ? distillKbDocumentAnalysisForRuntime(raw)
    : raw;
  const sourceHash = computeRuntimeDistillSourceHash(heuristic);

  const cached = getCachedKbRuntimeDistill(doc, sourceHash);
  if (cached) {
    return {
      text: clipRuntimeText(cached, perDocBudget),
      usedLlmDistill: true,
      usedCache: true,
    };
  }

  const provider = String(ai?.provider ?? '').trim();
  const model = String(ai?.model ?? '').trim();
  if (!provider || !model || !kbDocumentHasUsableAnalysis(doc)) {
    return {
      text: clipRuntimeText(heuristic, perDocBudget),
      usedLlmDistill: false,
      usedCache: false,
    };
  }

  try {
    const { runtimeDistilledMarkdown } = await distillKbDocumentAnalysisRuntime({
      documentName: doc.name,
      analysisMarkdown: heuristic,
      provider,
      model,
      callMeta: ai.callMeta,
      taskContext: ai.taskContext,
    });
    const distilled = runtimeDistilledMarkdown.trim();
    if (distilled) {
      callbacks?.applyKbDocumentPatch?.(doc.id, {
        documentAnalysisRuntimeDistillMarkdown: distilled,
        documentAnalysisRuntimeDistillSourceHash: sourceHash,
      });
      return {
        text: clipRuntimeText(distilled, perDocBudget),
        usedLlmDistill: true,
        usedCache: false,
      };
    }
  } catch {
    /* fallback euristico */
  }

  return {
    text: clipRuntimeText(heuristic, perDocBudget),
    usedLlmDistill: false,
    usedCache: false,
  };
}

export type ResolveBackendRuntimeDistillResult = {
  text: string;
  usedLlmDistill: boolean;
  usedCache: boolean;
};

/**
 * Sintesi backend per use case: cache LLM, distillazione estrema, fallback euristico.
 */
export async function resolveBackendRuntimeDistillText(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string,
  ai: RuntimeDistillAiParams | undefined,
  callbacks: RuntimeDistillCallbacks | undefined
): Promise<ResolveBackendRuntimeDistillResult> {
  const id = String(agentTaskId ?? '').trim();
  if (!id || !catalog) return { text: '', usedLlmDistill: false, usedCache: false };

  const heuristic = buildBackendAnalysisContextBlock(catalog, id).trim();
  if (!heuristic) return { text: '', usedLlmDistill: false, usedCache: false };

  const sourceHash = computeRuntimeDistillSourceHash(heuristic);
  const bundle = readAgentBackendAnalysisBundle(catalog, id);
  const cached = getCachedBackendRuntimeDistill(
    {
      analysisMarkdown: bundle.analysisMarkdown,
      agentAnalysisBaselineMarkdown: bundle.agentAnalysisBaselineMarkdown,
      runtimeDistilledMarkdown: bundle.runtimeDistilledMarkdown,
      runtimeDistillSourceHash: bundle.runtimeDistillSourceHash,
    },
    sourceHash
  );
  if (cached) {
    return { text: cached, usedLlmDistill: true, usedCache: true };
  }

  const provider = String(ai?.provider ?? '').trim();
  const model = String(ai?.model ?? '').trim();
  if (!provider || !model) {
    return { text: heuristic, usedLlmDistill: false, usedCache: false };
  }

  try {
    const { runtimeDistilledMarkdown } = await distillBackendAnalysisRuntime({
      agentTaskId: id,
      analysisMarkdown: heuristic,
      provider,
      model,
      callMeta: ai.callMeta,
      taskContext: ai.taskContext,
    });
    const distilled = runtimeDistilledMarkdown.trim();
    if (distilled) {
      callbacks?.applyBackendAnalysisPatch?.({
        runtimeDistilledMarkdown: distilled,
        runtimeDistillSourceHash: sourceHash,
      });
      return { text: distilled, usedLlmDistill: true, usedCache: false };
    }
  } catch {
    /* fallback */
  }

  return { text: heuristic, usedLlmDistill: false, usedCache: false };
}

/** Testo KB già in cache (sync) per compile — senza chiamata LLM. */
export function resolveKbRuntimeDistillTextSync(
  doc: StagedKbDocument,
  perDocBudget: number
): string {
  const raw = String(doc.documentAnalysisMarkdown ?? '').trim();
  if (!raw) return '';
  const heuristic = kbDocumentHasUsableAnalysis(doc)
    ? distillKbDocumentAnalysisForRuntime(raw)
    : raw;
  const sourceHash = computeRuntimeDistillSourceHash(heuristic);
  const cached = getCachedKbRuntimeDistill(doc, sourceHash);
  const text = cached ?? heuristic;
  return clipRuntimeText(text, perDocBudget);
}

/** Sintesi backend in cache (sync) per compile. */
export function resolveBackendRuntimeDistillTextSync(
  catalog: ProjectBackendCatalogBlob | undefined,
  agentTaskId: string
): string {
  const id = String(agentTaskId ?? '').trim();
  if (!id || !catalog) return '';
  const heuristic = buildBackendAnalysisContextBlock(catalog, id).trim();
  if (!heuristic) return '';
  const sourceHash = computeRuntimeDistillSourceHash(heuristic);
  const bundle = readAgentBackendAnalysisBundle(catalog, id);
  const cached = getCachedBackendRuntimeDistill(
    {
      analysisMarkdown: bundle.analysisMarkdown,
      agentAnalysisBaselineMarkdown: bundle.agentAnalysisBaselineMarkdown,
      runtimeDistilledMarkdown: bundle.runtimeDistilledMarkdown,
      runtimeDistillSourceHash: bundle.runtimeDistillSourceHash,
    },
    sourceHash
  );
  return cached ?? heuristic;
}
