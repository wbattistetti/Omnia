/**
 * Contratto facade `EditorParam`: SEND (`SendParameterValueEditor`) vs RECEIVE (`ReceiveVariableMenu`).
 */

import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';

/** Patch applicato al mapping task (stesso significato di BackendMappingCommitPatch). */
export type EditorParamCommitPatch = {
  variableRefId?: string;
  literalConstant?: string;
};

export interface EditorParamProps {
  mode: 'send' | 'receive';
  variableRefId?: string;
  /** SEND: costante letterale quando non è un GUID variabile. */
  literalConstant?: string;
  /** Euristica GUID noto vs testo libero (default: tutti `variableOptions`). */
  knownVariableIds?: ReadonlySet<string>;
  variableOptions: string[];
  placeholder?: string;
  accentClassName?: string;
  onCommit: (patch: EditorParamCommitPatch) => void;
  onCreateVariable?: (displayName: string) => { id: string; label: string } | null;
  onVariableCreated?: () => void;
  /** SEND: tipo OpenAPI per controllo costante. */
  openApiInputKind?: OpenApiInputUiKind;
  /** SEND: nome campo API (es. startDate) per UI data estesa. */
  apiField?: string;
}
