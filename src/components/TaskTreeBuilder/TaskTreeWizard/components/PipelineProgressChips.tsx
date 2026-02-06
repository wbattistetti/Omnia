// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import PipelineProgressChip from './PipelineProgressChip';

export interface PipelineProgressState {
  constraints: 'idle' | 'in-progress' | 'completed';
  contracts: 'idle' | 'in-progress' | 'completed';
  messaggi: 'idle' | 'in-progress' | 'completed';
  currentMessageStep?: string; // Solo quando messaggi è in-progress: "start", "normal", ecc.
}

interface PipelineProgressChipsProps {
  progress: PipelineProgressState;
}

const PipelineProgressChips: React.FC<PipelineProgressChipsProps> = ({ progress }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Chip Constraints - sempre visibile se non idle */}
      {progress.constraints !== 'idle' && (
        <PipelineProgressChip
          type="constraints"
          status={progress.constraints === 'completed' ? 'completed' : 'in-progress'}
        />
      )}

      {/* Chip Contracts - visibile solo se constraints è completato */}
      {progress.constraints === 'completed' && progress.contracts !== 'idle' && (
        <PipelineProgressChip
          type="contracts"
          status={progress.contracts === 'completed' ? 'completed' : 'in-progress'}
        />
      )}

      {/* Chip Messaggi - visibile solo se contracts è completato */}
      {progress.contracts === 'completed' && progress.messaggi !== 'idle' && (
        <PipelineProgressChip
          type="messaggi"
          status={progress.messaggi === 'completed' ? 'completed' : 'in-progress'}
          currentStepName={progress.currentMessageStep}
        />
      )}
    </div>
  );
};

export default PipelineProgressChips;
