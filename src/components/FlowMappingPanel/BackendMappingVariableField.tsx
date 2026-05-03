/**
 * Compat / re-export: `MappingRowFields` usa `SendParameterValueEditor` / `ReceiveVariableMenu`;
 * questo wrapper resta per import storici (`BackendMappingCommitPatch`, alias props send).
 */

import React from 'react';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import { EditorParam } from './EditorParam';
import type { EditorParamCommitPatch, EditorParamProps } from './editorParamTypes';

export type BackendMappingCommitPatch = EditorParamCommitPatch;

export interface BackendMappingVariableFieldProps
  extends Omit<EditorParamProps, 'openApiInputKind' | 'apiField'> {
  /** Alias verso `EditorParam.openApiInputKind` (nome storico nel mapping). */
  sendLiteralUiKind?: OpenApiInputUiKind;
  sendApiField?: string;
}

export function BackendMappingVariableField({
  sendLiteralUiKind,
  sendApiField,
  ...rest
}: BackendMappingVariableFieldProps) {
  return (
    <EditorParam
      {...rest}
      openApiInputKind={sendLiteralUiKind}
      apiField={sendApiField}
    />
  );
}

/** Editor riutilizzabile per altri contesti (stesso contratto). */
export { EditorParam } from './EditorParam';
export type { EditorParamCommitPatch, EditorParamProps } from './editorParamTypes';
