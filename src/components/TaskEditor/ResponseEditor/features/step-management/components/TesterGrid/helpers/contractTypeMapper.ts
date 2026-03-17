import type { ContractType } from '@components/DialogueDataEngine/contracts/contractLoader';

export type EditorType = 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow';

/**
 * Maps contract type to editor type.
 * 'rules' contract type maps to 'extractor' editor type.
 * 'grammarflow' doesn't have an inline editor (uses separate Grammar Editor), so returns 'grammarflow'.
 * All other contract types map directly to their editor type.
 */
export function getEditorTypeFromContractType(contractType: ContractType): EditorType {
  if (contractType === 'rules') return 'extractor';
  return contractType as EditorType;
}
