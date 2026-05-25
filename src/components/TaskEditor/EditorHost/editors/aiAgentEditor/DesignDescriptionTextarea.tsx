/**
 * Descrizione task: Monaco markdown + revisione osservazioni (stato da dock).
 */

import React from 'react';
import { MissingDesignerLlmModelAlert } from '@components/settings/designerLlm/MissingDesignerLlmModelAlert';
import { isDesignerLlmMissingModelMessage } from '@components/settings/designerLlm/designerLlmMessages';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';
import { AgentDescriptionMarkdownEditor } from './AgentDescriptionMarkdownEditor';
import { AgentTaskTextObservationReviewShell } from './AgentTaskTextObservationReviewShell';
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

  if (!editorCtx) {
    return (
      <p className="p-3 text-sm text-red-300">
        Pannello Descrizione: AIAgentEditorDockProvider mancante.
      </p>
    );
  }

  const fieldId = 'designDescription' as const;

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
        <AgentTaskTextObservationReviewShell
          fieldId={fieldId}
          currentText={editorCtx.designDescription}
          baseline={editorCtx.getTaskTextBaseline(fieldId)}
          onApplyFinalText={(text) => editorCtx.applyTaskTextFieldText(fieldId, text)}
          onCommitBaseline={(text) => editorCtx.setTaskTextBaseline(fieldId, text)}
          projectId={editorCtx.projectId}
          buildCallMeta={editorCtx.buildCallMeta}
          offerDismissed={editorCtx.isTaskTextReviewOfferDismissed(fieldId)}
          onDismissOffer={() => editorCtx.dismissTaskTextReviewOffer(fieldId)}
          onClearOfferDismissed={() => editorCtx.clearTaskTextReviewOfferDismissed(fieldId)}
          generating={editorCtx.generating}
          onError={editorCtx.onTaskTextReviewError}
        >
          {({ reviewBlocksEdit }) => (
            <AgentDescriptionMarkdownEditor
              value={editorCtx.designDescription}
              onChange={(value) => {
                editorCtx.setDesignDescription(value);
                tutorNotifyUserEdit(0);
              }}
              readOnly={
                (editorCtx.generating ?? false) || reviewBlocksEdit
              }
              insertBackendPathInDesign={editorCtx.insertBackendPathInDesign}
              tutorHostId={UI_IDS.taskDescriptionInput}
            />
          )}
        </AgentTaskTextObservationReviewShell>
      </div>
    </div>
  );
}
