/**
 * Review portal: standalone «Copy system prompt» → stesso dialog dell'editor Omnia (Deploy menu).
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { useAIAgentEditorDock } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import { ConversationalPromptDialog } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/useCaseGeneratorWizard/ConversationalPromptDialog';
import { DEFAULT_CONVERSATIONAL_CATALOG_FORMAT } from '@domain/useCaseGeneratorWizard/catalogFormat';
import type { ConversationalCatalogFormat } from '@domain/useCaseGeneratorWizard/catalogFormat';
import { areAllUseCasesProjectable } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';

const COPY_PROMPT_DISABLED_REASON =
  'Disponibile quando tutti gli use case inclusi sono compilabili nel catalogo runtime.';

/** Header button + overlay dialog for copying the conversational system prompt. */
export function ReviewCopySystemPromptControl(): React.ReactElement {
  const {
    useCases,
    conversationalRules,
    agentLogUseCase,
    agentBehavior,
  } = useAIAgentEditorDock();

  const [open, setOpen] = React.useState(false);
  const [catalogFormat, setCatalogFormat] = React.useState<ConversationalCatalogFormat>(
    DEFAULT_CONVERSATIONAL_CATALOG_FORMAT
  );

  const canCopy = React.useMemo(
    () => Array.isArray(useCases) && useCases.length > 0 && areAllUseCasesProjectable(useCases),
    [useCases]
  );

  const handleOpen = React.useCallback(() => {
    if (!canCopy) return;
    setOpen(true);
  }, [canCopy]);

  const handleClose = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        disabled={!canCopy}
        onClick={handleOpen}
        title={
          canCopy
            ? 'Apre il prompt conversazionale per copiarlo nel motore esterno'
            : COPY_PROMPT_DISABLED_REASON
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/70 bg-violet-800/80 px-2.5 py-1.5 text-xs font-semibold text-violet-50 shadow hover:bg-violet-700/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <FileText size={13} aria-hidden className="text-violet-200" />
        Copy system prompt
      </button>

      <ConversationalPromptDialog
        open={open}
        useCases={useCases}
        conversationalRules={conversationalRules}
        includeLog={agentLogUseCase}
        agentBehavior={agentBehavior}
        catalogFormat={catalogFormat}
        onCatalogFormatChange={setCatalogFormat}
        onClose={handleClose}
      />
    </>
  );
}
