/**
 * Descrizione task: Monaco markdown + pillola polish (stato da dock).
 */

import React from 'react';
import { MissingDesignerLlmModelAlert } from '@components/settings/designerLlm/MissingDesignerLlmModelAlert';
import { isDesignerLlmMissingModelMessage } from '@components/settings/designerLlm/designerLlmMessages';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { DesignDescriptionPolishOffer } from './DesignDescriptionPolishOffer';
import { AgentDescriptionMarkdownEditor } from './AgentDescriptionMarkdownEditor';
import { UI_IDS } from './activeTutor/uiIds';
import { tutorNotifyUserEdit } from './activeTutor/useActiveTutorSync';

export interface DesignDescriptionTextareaProps {
  className?: string;
  containerClassName?: string;
}

export function DesignDescriptionTextarea({
  containerClassName = 'flex h-full min-h-0 flex-col',
}: DesignDescriptionTextareaProps): React.ReactElement {
  const editorCtx = useOptionalAIAgentEditorDock();
  const readOnly =
    (editorCtx?.generating ?? false) || (editorCtx?.designDescriptionPolishBusy ?? false);

  if (!editorCtx) {
    return (
      <p className="p-3 text-sm text-red-300">
        Pannello Descrizione: AIAgentEditorDockProvider mancante.
      </p>
    );
  }

  return (
    <div className={containerClassName}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {isDesignerLlmMissingModelMessage(editorCtx.useCaseComposerError) ? (
          <MissingDesignerLlmModelAlert
            onModelSelected={editorCtx.onClearUseCaseComposerError}
            publishedSnapshot={editorCtx.reviewDesignerLlm}
          />
        ) : editorCtx.useCaseComposerError ? (
          <div
            className="mb-2 shrink-0 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200"
            role="alert"
          >
            {editorCtx.useCaseComposerError}
          </div>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <AgentDescriptionMarkdownEditor
            value={editorCtx.designDescription}
            onChange={(value) => {
              editorCtx.setDesignDescription(value);
              tutorNotifyUserEdit(0);
            }}
            readOnly={readOnly}
            insertBackendPathInDesign={editorCtx.insertBackendPathInDesign}
            tutorHostId={UI_IDS.taskDescriptionInput}
          />
          <DesignDescriptionPolishOffer
            visible={editorCtx.showDesignDescriptionPolishOffer}
            busy={editorCtx.designDescriptionPolishBusy}
            onAccept={() => void editorCtx.onPolishDesignDescription()}
            onDismiss={editorCtx.onDismissDesignDescriptionPolishOffer}
          />
        </div>
      </div>
    </div>
  );
}
