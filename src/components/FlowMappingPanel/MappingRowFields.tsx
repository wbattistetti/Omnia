/**
 * Per-row field strip: backend (API + variable) as label → edit in place. Interface: no extra fields.
 * Colonna variabile: SEND → `SendParameterValueEditor` (costante tipizzata + lista); RECEIVE → `ReceiveVariableMenu` (solo lista).
 */

import React, { useMemo } from 'react';
import type { MappingEntry } from './mappingTypes';
import { InlineFieldWithPencilEdit } from './InlineFieldWithPencilEdit';
import { ReceiveVariableMenu } from './ReceiveVariableMenu';
import { SendParameterValueEditor } from './SendParameterValueEditor';
import { getProjectTranslationsTable } from '../../utils/projectTranslationsRegistry';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import { unwrapSessionTreeWireKey } from './bookFromAgendaSessionTree';
import { mappingParamValueHottrack } from './mappingParameterHottrack';

export interface MappingRowFieldsProps {
  variant: 'backend' | 'interface';
  entry: MappingEntry | null;
  /** Parent node with children but no row at this path — compact visual spacers */
  groupOnlyBackend?: boolean;
  groupOnlyInterface?: boolean;
  /** Backend: when false, hide API field (variable only). */
  showApiFields?: boolean;
  /** Backend: nasconde la colonna nome API (es. sotto gruppi dove il trie mostra già il segmento). */
  hideApiFieldColumn?: boolean;
  /** Backend Arborist: `text-xs` su valore variabile / API. */
  compactTypography?: boolean;
  /** Backend: finché il nome interno è effimero, API/Variabile non prendono focus (prima la label). */
  secondaryFieldsLocked?: boolean;
  /** When true, API/var view spans use tabIndex -1 so Tab targets the internal-name label first. */
  suppressFieldTabFocus?: boolean;
  datalistApiId: string;
  datalistVarId: string;
  onPatch: (patch: Partial<MappingEntry>) => void;
  /** Backend: SEND = solo variabili esistenti; RECEIVE = crea al volo. */
  backendColumn?: 'send' | 'receive';
  variableOptions: string[];
  /** Backend: per euristica costante vs variabile (default: elenco `variableOptions`). */
  backendKnownVariableIds?: ReadonlySet<string>;
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
  /** Backend SEND: tipo UI per costante (OpenAPI Read API). Chiave = wireKey / internalName. */
  backendSendParamKindByWireKey?: Record<string, OpenApiInputUiKind>;
  /** Backend SEND: valori `enum` OpenAPI per costante (chiave = wireKey). */
  backendSendParamEnumByWireKey?: Record<string, string[]>;
}

export function MappingRowFields({
  variant,
  entry,
  groupOnlyBackend,
  groupOnlyInterface,
  showApiFields = true,
  hideApiFieldColumn = false,
  compactTypography = false,
  secondaryFieldsLocked = false,
  suppressFieldTabFocus = false,
  datalistApiId,
  datalistVarId,
  onPatch,
  backendColumn,
  variableOptions = [],
  backendKnownVariableIds,
  onCreateOutputVariable,
  onOutputVariableCreated,
  backendSendParamKindByWireKey,
  backendSendParamEnumByWireKey,
}: MappingRowFieldsProps) {
  const flowTr = useActiveFlowMetaTranslationsFlattened();
  const mergedTr = useMemo(() => ({ ...getProjectTranslationsTable(), ...flowTr }), [flowTr]);

  if (variant === 'backend' && groupOnlyBackend) {
    return (
      <div className="flex h-6 shrink-0 items-center gap-0 opacity-25 pointer-events-none" aria-hidden>
        {showApiFields && !hideApiFieldColumn ? <div className="h-[18px] w-14 shrink-0 rounded bg-slate-800/30" /> : null}
        <div className="h-[18px] w-[5.5rem] shrink-0 rounded bg-slate-800/30" />
      </div>
    );
  }

  if (variant === 'interface' && groupOnlyInterface) {
    return (
      <div className="flex h-7 shrink-0 items-center gap-0 opacity-25 pointer-events-none" aria-hidden>
        <div className="h-6 w-24 shrink-0 rounded bg-slate-800/30" />
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  if (variant === 'backend') {
    void datalistApiId;
    void suppressFieldTabFocus;
    const varMode = backendColumn === 'receive' ? 'receive' : 'send';
    const varLabel = entry.variableRefId
      ? resolveVariableDisplayName(entry.variableRefId, 'menuVariables', {
          compiledTranslations: mergedTr,
          flowMetaTranslations: mergedTr,
        })
      : '';
    const wireMetaKey = unwrapSessionTreeWireKey(entry.wireKey.trim());
    const sendKind =
      backendColumn === 'send' ? backendSendParamKindByWireKey?.[wireMetaKey] : undefined;
    const sendEnum =
      backendColumn === 'send' ? backendSendParamEnumByWireKey?.[wireMetaKey] : undefined;
    const apiRef = (entry.apiField || '').trim();
    return (
      <div className="flex min-w-0 shrink-0 items-center gap-0">
        {showApiFields && !hideApiFieldColumn ? (
          <span
            className={`h-6 min-h-[22px] min-w-0 max-w-[10rem] shrink-0 truncate rounded border border-transparent bg-slate-900/40 px-1 font-mono leading-6 text-slate-400 cursor-default select-none tabular-nums ${mappingParamValueHottrack} ${compactTypography ? 'text-xs' : 'text-[10px]'}`}
            title={
              apiRef
                ? `Backend parameter name (read-only): ${apiRef}`
                : 'Backend parameter name (read-only, from OpenAPI / import)'
            }
          >
            {apiRef || '—'}
          </span>
        ) : null}
        {secondaryFieldsLocked ? (
          <InlineFieldWithPencilEdit
            value={varLabel}
            placeholder="Variabile"
            ariaLabel="Variabile collegata"
            listId={datalistVarId}
            accent="amber"
            suppressFocus
            viewTabIndex={-1}
            onCommit={() => {}}
          />
        ) : varMode === 'receive' ? (
          <ReceiveVariableMenu
            variableRefId={entry.variableRefId}
            variableOptions={variableOptions}
            onCommit={(patch) => onPatch(patch)}
            onCreateVariable={onCreateOutputVariable}
            onVariableCreated={onOutputVariableCreated}
            compactTypography={compactTypography}
          />
        ) : (
          <SendParameterValueEditor
            variableRefId={entry.variableRefId}
            literalConstant={entry.literalConstant}
            knownVariableIds={backendKnownVariableIds ?? new Set(variableOptions)}
            variableOptions={variableOptions}
            onCommit={(patch) => onPatch(patch)}
            openApiInputKind={sendKind}
            openApiEnumValues={sendEnum}
            apiField={entry.apiField}
            compactTypography={compactTypography}
          />
        )}
      </div>
    );
  }

  return null;
}
