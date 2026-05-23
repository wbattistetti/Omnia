/**
 * Selezione modello LLM designer condivisa (Omnia Tutor + portale review): catalogo live,
 * gate costi premium, sync con {@link AIProviderContext} e persistenza Omnia Tutor.
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import { useAvailableLlmModels } from '@hooks/useAvailableLlmModels';
import { useLlmPricingCatalog } from '@hooks/useLlmPricingCatalog';
import { useAiCallLog } from '@context/AiCallLogContext';
import {
  buildCostComparatorRows,
  filterPricingByProviders,
  isAboveCostThresholdEur,
  type CostComparatorRow,
  type ProviderId,
} from '@domain/aiCost/costComparator';
import {
  designerLlmContextProvider,
  designerLlmProviderSpecs,
  DESIGNER_LLM_PROVIDERS,
} from './designerLlmProviders';
import {
  loadOmniaTutorConfig,
  saveOmniaTutorConfig,
} from '@utils/omniaTutor/omniaTutorPersistence';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import { DEFAULT_UNLOCK_PASSWORD } from '@components/common/CostComparatorTable';

/** Soglia €/M token oltre la quale serve password di sblocco (stessa regola di Omnia Tutor). */
export const DESIGNER_LLM_COST_LOCK_THRESHOLD_EUR = 10;

export interface UseDesignerLlmModelSelectionParams {
  /** Modello controllato dal parent (Omnia Tutor). Se omesso, legge da localStorage. */
  model?: string;
  /** Commit selezione modello. Se omesso, persiste in Omnia Tutor config. */
  onModelChange?: (modelId: string) => void;
  /** Snapshot pubblicato da Omnia al load del canale review (applicato una volta). */
  publishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
}

export interface DesignerLlmModelSelectionState {
  model: string;
  modelOptions: ReturnType<typeof useAvailableLlmModels>['items'];
  modelsLoading: boolean;
  modelErrors: ReturnType<typeof useAvailableLlmModels>['errors'];
  reloadModels: () => void;
  hasModelOptions: boolean;
  hasValidSelection: boolean;
  errorSummary: string | null;
  requestSelectModel: (modelId: string) => void;
  pendingUnlock: {
    readonly rowKey: string;
    readonly modelId: string;
    readonly providerId: ProviderId;
  } | null;
  handlePendingUnlockSubmit: (password: string) => boolean;
  handlePendingUnlockCancel: () => void;
  unlockedKeys: ReadonlySet<string>;
  handleUnlockFromTable: (rowKey: string) => void;
  handleSelectFromGrid: (entry: { providerId: string; modelId: string }) => void;
}

export function useDesignerLlmModelSelection(
  params: UseDesignerLlmModelSelectionParams = {}
): DesignerLlmModelSelectionState {
  const { setProvider, setModel } = useAIProvider();
  const providerSpecs = React.useMemo(() => designerLlmProviderSpecs(), []);
  const {
    items: modelOptions,
    loading: modelsLoading,
    errors: modelErrors,
    reload: reloadModels,
  } = useAvailableLlmModels(providerSpecs);

  const [internalModel, setInternalModel] = React.useState(() => loadOmniaTutorConfig().model);
  const isControlled = params.model !== undefined;
  const model = isControlled ? params.model! : internalModel;

  const commitModel = React.useCallback(
    (modelId: string) => {
      if (params.onModelChange) {
        params.onModelChange(modelId);
      } else {
        setInternalModel(modelId);
        const cfg = loadOmniaTutorConfig();
        saveOmniaTutorConfig({ ...cfg, model: modelId });
      }
    },
    [params.onModelChange]
  );

  const appliedSnapshotRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const snap = params.publishedSnapshot;
    if (!snap?.model?.trim()) return;
    const key = `${snap.provider}:${snap.model}`;
    if (appliedSnapshotRef.current === key) return;
    appliedSnapshotRef.current = key;
    setProvider(snap.provider);
    setModel(snap.model);
    commitModel(snap.model);
  }, [params.publishedSnapshot, setProvider, setModel, commitModel]);

  React.useEffect(() => {
    const opt = modelOptions.find((o) => o.id === model);
    if (opt) {
      const ctxProvider = designerLlmContextProvider(opt.provider);
      if (ctxProvider) setProvider(ctxProvider);
    }
    setModel(model);
  }, [model, modelOptions, setModel, setProvider]);

  const pricingCatalog = useLlmPricingCatalog();
  const { exchangeRate } = useAiCallLog();
  const tutorAllowedProviders = React.useMemo<ReadonlySet<ProviderId>>(
    () =>
      new Set<ProviderId>(
        DESIGNER_LLM_PROVIDERS.map((p) => p.id).filter((id): id is ProviderId =>
          (['openai', 'groq', 'anthropic', 'google'] as const).includes(id as ProviderId)
        )
      ),
    []
  );

  const pricingRows = React.useMemo<ReadonlyArray<CostComparatorRow>>(() => {
    const filtered = filterPricingByProviders(pricingCatalog.items, tutorAllowedProviders);
    return buildCostComparatorRows(filtered, exchangeRate?.usdToEur ?? null);
  }, [pricingCatalog.items, tutorAllowedProviders, exchangeRate?.usdToEur]);

  const findPricingRowForModel = React.useCallback(
    (modelId: string): CostComparatorRow | null => {
      const id = modelId.trim();
      if (!id) return null;
      return pricingRows.find((r) => r.modelId === id || r.key.endsWith(`/${id}`)) ?? null;
    },
    [pricingRows]
  );

  const [unlockedKeys, setUnlockedKeys] = React.useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const [pendingUnlock, setPendingUnlock] = React.useState<{
    readonly rowKey: string;
    readonly modelId: string;
    readonly providerId: ProviderId;
  } | null>(null);

  const requestSelectModel = React.useCallback(
    (modelId: string) => {
      if (!modelId || modelId === model) {
        setPendingUnlock(null);
        return;
      }
      const row = findPricingRowForModel(modelId);
      const needsUnlock =
        row !== null &&
        isAboveCostThresholdEur(row, DESIGNER_LLM_COST_LOCK_THRESHOLD_EUR) &&
        !unlockedKeys.has(row.key);
      if (needsUnlock) {
        setPendingUnlock({
          rowKey: row.key,
          modelId,
          providerId: row.providerId,
        });
        return;
      }
      setPendingUnlock(null);
      commitModel(modelId);
    },
    [model, findPricingRowForModel, commitModel, unlockedKeys]
  );

  const handlePendingUnlockSubmit = React.useCallback(
    (password: string): boolean => {
      if (!pendingUnlock) return false;
      if (password !== DEFAULT_UNLOCK_PASSWORD) return false;
      const target = pendingUnlock;
      setUnlockedKeys((prev) => {
        const next = new Set(prev);
        next.add(target.rowKey);
        return next;
      });
      setPendingUnlock(null);
      commitModel(target.modelId);
      return true;
    },
    [pendingUnlock, commitModel]
  );

  const handlePendingUnlockCancel = React.useCallback(() => {
    setPendingUnlock(null);
  }, []);

  const handleUnlockFromTable = React.useCallback((rowKey: string) => {
    setUnlockedKeys((prev) => {
      const next = new Set(prev);
      next.add(rowKey);
      return next;
    });
  }, []);

  const handleSelectFromGrid = React.useCallback(
    (entry: { providerId: string; modelId: string }) => {
      requestSelectModel(entry.modelId);
    },
    [requestSelectModel]
  );

  const hasModelOptions = modelOptions.length > 0;
  const hasValidSelection = React.useMemo(() => {
    const selected = typeof model === 'string' ? model.trim() : '';
    if (!selected) return false;
    return modelOptions.some((o) => o.id === selected);
  }, [model, modelOptions]);

  const errorSummary = modelErrors.length
    ? modelErrors.map((e) => `${e.provider}: ${e.message}`).join(' | ')
    : null;

  return {
    model,
    modelOptions,
    modelsLoading,
    modelErrors,
    reloadModels,
    hasModelOptions,
    hasValidSelection,
    errorSummary,
    requestSelectModel,
    pendingUnlock,
    handlePendingUnlockSubmit,
    handlePendingUnlockCancel,
    unlockedKeys,
    handleUnlockFromTable,
    handleSelectFromGrid,
  };
}
