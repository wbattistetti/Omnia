/**
 * API client analisi sovrapposizioni use case (design-time).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type {
  UseCaseOverlapHint,
  UseCaseOverlapReport,
} from '@domain/aiAgentUseCase/useCaseSemanticOverlap';
import {
  DEFAULT_USE_CASE_OVERLAP_THRESHOLD,
  formatOverlapDesignerMessage,
  overlapClassificationLabel,
  parseOverlapHintField,
} from '@domain/aiAgentUseCase/useCaseSemanticOverlap';
import { buildUseCaseCatalogNumberById } from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import { isUseCaseIncludedInConversations } from '@types/aiAgentUseCases';
import {
  analyzeUseCaseOverlapApi,
  checkUseCaseOverlapsApi,
  type AiCallMeta,
} from '@services/aiAgentDesignApi';

export {
  DEFAULT_USE_CASE_OVERLAP_THRESHOLD,
  overlapClassificationLabel,
  parseOverlapHintField,
};
export type {
  UseCaseOverlapHint,
  UseCaseOverlapReport,
  UseCaseOverlapClassification,
} from '@domain/aiAgentUseCase/useCaseSemanticOverlap';

function mapAnalyzeResponse(
  body: Record<string, unknown>,
  catalogNumberById: Map<string, number>,
  labelById: Map<string, string>
): UseCaseOverlapHint {
  const relatedRaw = Array.isArray(body.related) ? body.related : [];
  const related = relatedRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const useCaseId = String(r.use_case_id ?? '').trim();
      if (!useCaseId) return null;
      const label = labelById.get(useCaseId) || useCaseId;
      return {
        useCaseId,
        catalogNumber: catalogNumberById.get(useCaseId),
        label,
        relation: r.relation === 'duplicate_of' ? ('duplicate_of' as const) : ('variant_of' as const),
        score: typeof r.score === 'number' ? r.score : 0,
        ...(typeof r.reason === 'string' && r.reason.trim() ? { reason: r.reason.trim() } : {}),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const classification =
    body.classification === 'duplicate' || body.classification === 'variant'
      ? body.classification
      : 'new';

  const designerMessage =
    typeof body.designer_message === 'string' ? body.designer_message.trim() : '';

  const hint: UseCaseOverlapHint = {
    classification,
    score: typeof body.score === 'number' ? body.score : 0,
    ...(typeof body.primary_intent === 'string' && body.primary_intent.trim()
      ? { primaryIntent: body.primary_intent.trim() }
      : {}),
    related,
    designerMessage,
    analyzedAt: new Date().toISOString(),
  };
  if (!hint.designerMessage.trim()) {
    return {
      ...hint,
      designerMessage: formatOverlapDesignerMessage(hint, catalogNumberById),
    };
  }
  return hint;
}

function mapCheckResponse(body: Record<string, unknown>, threshold: number): UseCaseOverlapReport {
  const clustersRaw = Array.isArray(body.clusters) ? body.clusters : [];
  const clusters = clustersRaw.map((c, i) => {
    const o = c as Record<string, unknown>;
    const pairsRaw = Array.isArray(o.pairs) ? o.pairs : [];
    return {
      clusterId: String(o.cluster_id ?? `cluster-${i + 1}`),
      useCaseIds: Array.isArray(o.use_case_ids) ? o.use_case_ids.map(String) : [],
      classification: o.classification === 'duplicate' ? ('duplicate' as const) : ('variant'),
      headline: typeof o.headline === 'string' ? o.headline : '',
      pairs: pairsRaw.map((p) => {
        const pr = p as Record<string, unknown>;
        return {
          useCaseAId: String(pr.use_case_a_id ?? ''),
          useCaseBId: String(pr.use_case_b_id ?? ''),
          classification: pr.classification === 'duplicate' ? ('duplicate' as const) : ('variant'),
          score: typeof pr.score === 'number' ? pr.score : 0,
          summary: typeof pr.summary === 'string' ? pr.summary : '',
        };
      }),
    };
  });
  return {
    threshold,
    pairCount: typeof body.pair_count === 'number' ? body.pair_count : 0,
    clusters,
    generatedAt:
      typeof body.generated_at === 'string' ? body.generated_at : new Date().toISOString(),
  };
}

export type AnalyzeUseCaseOverlapParams = {
  candidateUseCase: AIAgentUseCase;
  catalogUseCases: readonly AIAgentUseCase[];
  threshold?: number;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
};

/** Analizza un use case vs catalogo (post-creazione manuale). */
export async function analyzeUseCase(params: AnalyzeUseCaseOverlapParams): Promise<UseCaseOverlapHint> {
  const included = params.catalogUseCases.filter(isUseCaseIncludedInConversations);
  const numberById = buildUseCaseCatalogNumberById(included);
  const threshold = params.threshold ?? DEFAULT_USE_CASE_OVERLAP_THRESHOLD;

  const body = await analyzeUseCaseOverlapApi({
    candidateUseCase: params.candidateUseCase,
    catalogUseCases: params.catalogUseCases,
    catalogNumberById: Object.fromEntries(numberById),
    threshold,
    provider: params.provider,
    model: params.model,
    callMeta: params.callMeta,
  });
  const labelById = new Map(
    params.catalogUseCases.map((uc) => [uc.id, uc.label?.trim() || uc.id])
  );
  return mapAnalyzeResponse(body, numberById, labelById);
}

export type CheckUseCaseOverlapsParams = {
  useCases: readonly AIAgentUseCase[];
  threshold?: number;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
};

/** Verifica sovrapposizioni su tutto il catalogo. */
export async function checkOverlap(params: CheckUseCaseOverlapsParams): Promise<UseCaseOverlapReport> {
  const threshold = params.threshold ?? DEFAULT_USE_CASE_OVERLAP_THRESHOLD;
  const body = await checkUseCaseOverlapsApi({
    useCases: params.useCases,
    threshold,
    provider: params.provider,
    model: params.model,
    callMeta: params.callMeta,
  });
  return mapCheckResponse(body, threshold);
}

/** Normalizza report API → modello UI (alias esplicito). */
export function generateReport(raw: UseCaseOverlapReport): UseCaseOverlapReport {
  return raw;
}
