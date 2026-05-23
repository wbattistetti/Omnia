/**
 * Banner «modello IA mancante»: link Seleziona apre {@link DesignerLlmSetupPanel} in modale.
 */

import React from 'react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import { useDesignerLlmSetupHost } from './DesignerLlmSetupHost';

export interface MissingDesignerLlmModelAlertProps {
  onModelSelected?: () => void;
  publishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
}

export function MissingDesignerLlmModelAlert({
  onModelSelected,
  publishedSnapshot,
}: MissingDesignerLlmModelAlertProps): React.ReactElement {
  const { model } = useAIProvider();
  const { openPanel } = useDesignerLlmSetupHost();
  const hadModelRef = React.useRef(Boolean(model?.trim()));

  React.useEffect(() => {
    const hasModel = Boolean(model?.trim());
    if (hasModel && !hadModelRef.current) {
      onModelSelected?.();
    }
    hadModelRef.current = hasModel;
  }, [model, onModelSelected]);

  const openSetup = React.useCallback(() => {
    openPanel({ publishedSnapshot: publishedSnapshot ?? null });
  }, [openPanel, publishedSnapshot]);

  return (
    <div
      className="mb-2 shrink-0 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200"
      role="alert"
    >
      <p>
        <button
          type="button"
          onClick={openSetup}
          className="font-semibold text-red-100 underline decoration-red-300/80 underline-offset-2 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          Seleziona
        </button>{' '}
        il modello di agente (motore IA) per abilitare polish, generazione use case e le altre azioni
        IA.
      </p>
    </div>
  );
}
