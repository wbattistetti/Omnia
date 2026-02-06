// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import WizardAI, { AccordionState } from '../WizardAI';
import { SchemaNode } from '../MainDataCollection';
import { PipelineProgressState } from './PipelineProgressChips';

interface WizardAISectionProps {
  state: AccordionState;
  structure?: SchemaNode[];
  schemaRootLabel?: string;
  onConfirm: () => void;
  onRefine: () => void;
  onEditManually: () => void;
  onStructureChange?: (mains: SchemaNode[]) => void;
  showRefiningTextbox?: boolean;
  refiningText?: string;
  onRefiningTextChange?: (text: string) => void;
  onApplyRefining?: () => void;
  onCreateWithAI?: () => void;
  isAIGenerating?: boolean;
  pipelineProgress?: PipelineProgressState;
}

const WizardAISection: React.FC<WizardAISectionProps> = (props) => {
  return <WizardAI {...props} />;
};

export default WizardAISection;
