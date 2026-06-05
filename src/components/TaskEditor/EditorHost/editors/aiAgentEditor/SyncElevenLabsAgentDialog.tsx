/**
 * Modale «Aggiorna agente ElevenLabs» — wrapper su {@link ConvaiAgentSyncPanel}.
 */

import React from 'react';
import Modal from '@components/Modal';
import type { ConvaiAgentSyncParams, ConvaiAgentSyncResult } from '@domain/convai/convaiAgentSyncTypes';
import { ConvaiAgentSyncPanel } from './ConvaiAgentSyncPanel';

export type SyncElevenLabsAgentDialogProps = {
  open: boolean;
  onClose: () => void;
  syncParams: ConvaiAgentSyncParams | null;
  onSynced?: (result: ConvaiAgentSyncResult) => void;
  elevatedOverlay?: boolean;
};

export function SyncElevenLabsAgentDialog({
  open,
  onClose,
  syncParams,
  onSynced,
  elevatedOverlay = false,
}: SyncElevenLabsAgentDialogProps): React.ReactElement {
  const [syncing, setSyncing] = React.useState(false);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Aggiorna agente ElevenLabs"
      isLoading={syncing}
      overlayClassName={elevatedOverlay ? 'z-[70]' : 'z-50'}
    >
      <ConvaiAgentSyncPanel
        syncParams={syncParams}
        active={open}
        onCancel={onClose}
        onSynced={onSynced}
        onSyncingChange={setSyncing}
      />
    </Modal>
  );
}

/** @deprecated Usare {@link SyncElevenLabsAgentDialog}. */
export { SyncElevenLabsAgentDialog as PublishElevenLabsWebhookDialog };
