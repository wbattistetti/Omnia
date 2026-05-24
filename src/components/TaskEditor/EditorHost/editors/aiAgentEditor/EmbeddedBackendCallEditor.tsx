/**
 * Editor Backend Call incassato nel tab Backends dell'AI Agent Editor.
 * Toolbar: EmbeddedBackendToolbar (modalità Emulation / Real Call + azioni contestuali).
 * Layout: toolbar shrink-0 in cima → BackendCallEditor che occupa il resto senza scroll esterno.
 */

import React from 'react';
import type { Task } from '../../../../../types/taskTypes';
import type { ToolbarButton } from '../../../../../dock/types';
import BackendCallEditor from '../BackendCallEditor';
import { BackendCallEmbeddedLayout } from './BackendCallEmbeddedLayout';
import { EmbeddedBackendToolbar } from './EmbeddedBackendToolbar';

export function EmbeddedBackendCallEditor({
  task,
  endpointExternalRevision = 0,
  /**
   * Se `true` (default), la riga endpoint è nascosta (URL gestito dall’header catalogo import).
   * In modalità «specs» emulate l’URL è opzionale e si modifica nell’editor.
   */
  hideEndpointRow = true,
  workspaceInspectorEmbed = false,
}: {
  task: Task;
  /** Incrementato dal parent quando URL/metodo sono aggiornati fuori dall'editor (header accordion). */
  endpointExternalRevision?: number;
  hideEndpointRow?: boolean;
  /** ElevenLabs workspace inspector: scroll unico sul pannello padre. */
  workspaceInspectorEmbed?: boolean;
}) {
  const [toolbarButtons, setToolbarButtons] = React.useState<ToolbarButton[]>([]);
  const [signatureSubOpen, setSignatureSubOpen] = React.useState(false);

  /** Stable callback — inline handler made BackendCallEditor's toolbar effect re-run every render. */
  const handleToolbarUpdate = React.useCallback((btns: ToolbarButton[]) => {
    setToolbarButtons((prev) => (prev === btns ? prev : btns));
  }, []);

  return (
    <BackendCallEmbeddedLayout
      deferScrollToParent={workspaceInspectorEmbed}
      toolbar={
        <EmbeddedBackendToolbar
          buttons={toolbarButtons}
          signatureSubOpen={signatureSubOpen}
          onSignatureSubOpenChange={setSignatureSubOpen}
        />
      }
    >
      <BackendCallEditor
        task={task}
        hideHeader
        hideEndpointRow={hideEndpointRow}
        endpointExternalRevision={endpointExternalRevision}
        embeddedSignatureSubToolbarOpen={signatureSubOpen}
        embeddedCloseSignatureToolbar={() => setSignatureSubOpen(false)}
        workspaceInspectorEmbed={workspaceInspectorEmbed}
        onToolbarUpdate={handleToolbarUpdate}
      />
    </BackendCallEmbeddedLayout>
  );
}
