/**
 * Pannello Dialog control: slot mapping.
 */

import React from 'react';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { SlotMappingRightPanel } from './SlotMappingRightPanel';

export type DialogControlPanelProps = {
  lexicon: ProjectSlotLexicon;
  onApproveLexiconEntry: (surface: string) => void;
  onRevokeLexiconEntry: (surface: string) => void;
  onUpdateLexiconSlotId: (surface: string, slotId: string) => void;
};

export function DialogControlPanel({
  lexicon,
  onApproveLexiconEntry,
  onRevokeLexiconEntry,
  onUpdateLexiconSlotId,
}: DialogControlPanelProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SlotMappingRightPanel
          lexicon={lexicon}
          onApproveEntry={onApproveLexiconEntry}
          onRevokeEntryApproval={onRevokeLexiconEntry}
          onUpdateSlotId={onUpdateLexiconSlotId}
        />
      </div>
    </div>
  );
}
