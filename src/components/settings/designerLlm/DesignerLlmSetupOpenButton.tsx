/**
 * Pulsante header per aprire {@link DesignerLlmSetupPanel} in modale (portale review).
 */

import React from 'react';
import { Settings2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import type { AgentReviewDesignerLlmSnapshot } from '@domain/agentReviewChannel/reviewDocument';
import { useDesignerLlmSetupHost } from './DesignerLlmSetupHost';

export interface DesignerLlmSetupOpenButtonProps {
  publishedSnapshot?: AgentReviewDesignerLlmSnapshot | null;
  className?: string;
}

export function DesignerLlmSetupOpenButton({
  publishedSnapshot,
  className = '',
}: DesignerLlmSetupOpenButtonProps): React.ReactElement {
  const { openPanel } = useDesignerLlmSetupHost();
  const { model, provider } = useAIProvider();

  const modelLabel = model?.trim()
    ? `${provider ? `${provider}/` : ''}${model}`
    : 'Nessun modello selezionato';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Motore IA
      </span>
      <span className="min-w-0 truncate text-xs text-slate-300" title={modelLabel}>
        {modelLabel}
      </span>
      <button
        type="button"
        onClick={() => openPanel({ publishedSnapshot: publishedSnapshot ?? null })}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-700/60 bg-violet-950/40 px-2.5 py-1 text-xs font-medium text-violet-100 hover:bg-violet-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
      >
        <Settings2 size={13} aria-hidden />
        Configura motore IA
      </button>
    </div>
  );
}
