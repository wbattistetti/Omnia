/**
 * React: recomputes when the active flow's `meta.translations` changes or flow-scoped writes bump revision.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import { flowWorkspaceMetaTranslationsFingerprint } from '../utils/compileWorkspaceTranslations';
import { getActiveFlowMetaTranslationsFlattened } from '../utils/activeFlowTranslations';

export function useActiveFlowMetaTranslationsFlattened(): Record<string, string> {
  const { flowTranslationRevision } = useProjectTranslations();
  const fp = useSyncExternalStore(
    (onStoreChange) => FlowWorkspaceSnapshot.subscribe(onStoreChange),
    flowWorkspaceMetaTranslationsFingerprint,
    flowWorkspaceMetaTranslationsFingerprint
  );
  return useMemo(
    () => getActiveFlowMetaTranslationsFlattened(),
    [fp, flowTranslationRevision]
  );
}
