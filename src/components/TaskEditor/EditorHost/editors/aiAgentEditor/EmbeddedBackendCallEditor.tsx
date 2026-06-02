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

/** Evita loop onToolbarUpdate quando BackendCallEditor ricrea l'array a ogni render. */
function embeddedToolbarSignature(buttons: ToolbarButton[]): string {
  return JSON.stringify(
    buttons.map((b) => ({
      label: b?.label,
      title: typeof b?.title === 'string' ? b.title : '',
      disabled: Boolean(b?.disabled),
      primary: Boolean(b?.primary),
      active: Boolean(b?.active),
      visible: b?.visible !== false,
      buttonId: (b as { buttonId?: string })?.buttonId,
      subBusy: Boolean(b?.subAction?.busy),
      subBusyLabel: b?.subAction?.busyLabel ?? '',
      subDisabled: Boolean(b?.subAction?.disabled),
      gwSubBusy: Boolean(b?.gatewaySubAction?.busy),
      gwSubDisabled: Boolean(b?.gatewaySubAction?.disabled),
    }))
  );
}

export function EmbeddedBackendCallEditor({
  task,
  endpointExternalRevision = 0,
  agentTaskId,
  /**
   * Se `true` (default), la riga endpoint è nascosta (URL gestito dall’header catalogo import).
   * In modalità «specs» emulate l’URL è opzionale e si modifica nell’editor.
   */
  hideEndpointRow = true,
  workspaceInspectorEmbed = false,
  /** Scroll unificato sulla colonna catalogo (Descrizione / Analisi / mapping). */
  catalogColumnScroll = false,
}: {
  task: Task;
  /** Incrementato dal parent quando URL/metodo sono aggiornati fuori dall'editor (header accordion). */
  endpointExternalRevision?: number;
  /** Task AI Agent padre — abilita test via gateway ConvAI. */
  agentTaskId?: string;
  hideEndpointRow?: boolean;
  /** ElevenLabs workspace inspector: scroll unico sul pannello padre. */
  workspaceInspectorEmbed?: boolean;
  catalogColumnScroll?: boolean;
}) {
  const scrollInParent = workspaceInspectorEmbed || catalogColumnScroll;
  const [toolbarButtons, setToolbarButtons] = React.useState<ToolbarButton[]>([]);
  const [signatureSubOpen, setSignatureSubOpen] = React.useState(false);
  const lastToolbarSigRef = React.useRef<string | null>(null);

  /** Stable callback — confronto per firma, non per riferimento array. */
  const handleToolbarUpdate = React.useCallback((btns: ToolbarButton[], _color: string) => {
    void _color;
    const sig = embeddedToolbarSignature(btns);
    if (lastToolbarSigRef.current === sig) return;
    lastToolbarSigRef.current = sig;
    setToolbarButtons(btns);
  }, []);

  return (
    <BackendCallEmbeddedLayout
      deferScrollToParent={scrollInParent}
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
        convaiGatewayTestAgentTaskId={agentTaskId}
        embeddedSignatureSubToolbarOpen={signatureSubOpen}
        embeddedCloseSignatureToolbar={() => setSignatureSubOpen(false)}
        workspaceInspectorEmbed={scrollInParent}
        onToolbarUpdate={handleToolbarUpdate}
      />
    </BackendCallEmbeddedLayout>
  );
}
