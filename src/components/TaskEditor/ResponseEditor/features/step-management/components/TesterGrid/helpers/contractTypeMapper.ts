import type { ContractType } from '../../../../DialogueDataEngine/contracts/contractLoader';

export type EditorType = 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';

/**
 * Maps contract type to editor type.
 * 'rules' contract type maps to 'extractor' editor type.
 * All other contract types map directly to their editor type.
 */
export function getEditorTypeFromContractType(contractType: ContractType): EditorType {
  if (contractType === 'rules') return 'extractor';
  return contractType as EditorType;
}
