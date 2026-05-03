/**
 * Facade mapping SEND/RECEIVE: delega a `SendParameterValueEditor` (costante tipizzata + variabili)
 * o `ReceiveVariableMenu` (solo lista variabile). Contratto unificato in `editorParamTypes`.
 */

import React from 'react';
import { SendParameterValueEditor } from './SendParameterValueEditor';
import { ReceiveVariableMenu } from './ReceiveVariableMenu';
import type { EditorParamProps } from './editorParamTypes';

export function EditorParam(props: EditorParamProps) {
  if (props.mode === 'receive') {
    return (
      <ReceiveVariableMenu
        variableRefId={props.variableRefId}
        variableOptions={props.variableOptions}
        placeholder={props.placeholder}
        accentClassName={props.accentClassName}
        onCommit={props.onCommit}
        onCreateVariable={props.onCreateVariable}
        onVariableCreated={props.onVariableCreated}
      />
    );
  }
  return (
    <SendParameterValueEditor
      variableRefId={props.variableRefId}
      literalConstant={props.literalConstant}
      knownVariableIds={props.knownVariableIds}
      variableOptions={props.variableOptions}
      placeholder={props.placeholder}
      accentClassName={props.accentClassName}
      onCommit={props.onCommit}
      openApiInputKind={props.openApiInputKind}
      apiField={props.apiField}
    />
  );
}
