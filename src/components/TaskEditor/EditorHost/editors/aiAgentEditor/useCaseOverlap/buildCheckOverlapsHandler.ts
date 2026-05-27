/**
 * Handler toolbar «Check overlap» — analisi catalogo completo.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  checkOverlap,
  generateReport,
  type UseCaseOverlapReport,
} from '@domain/useCaseOverlap/useCaseOverlapApi';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import type { AiCallMeta } from '@services/aiAgentDesignApi';

export function buildCheckOverlapsHandler(params: {
  getUseCases: () => readonly AIAgentUseCase[];
  provider: string;
  model: string;
  buildCallMeta: (purpose: string) => AiCallMeta;
  onReport: (report: UseCaseOverlapReport | null) => void;
}): () => Promise<void> {
  return async () => {
    const catalog = params.getUseCases();
    if (catalog.length < 2) {
      params.onReport({
        threshold: 0.8,
        pairCount: 0,
        clusters: [],
        generatedAt: new Date().toISOString(),
      });
      return;
    }
    const raw = await checkOverlap({
      useCases: catalog,
      provider: params.provider,
      model: params.model,
      callMeta: params.buildCallMeta(AI_CALL_PURPOSE.USE_CASE_CHECK_OVERLAPS),
    });
    params.onReport(generateReport(raw));
  };
}
