/**
 * Per-row field strip: backend (API + variable) as label → edit in place. Interface: no extra fields.
 */

import React from 'react';
import type { MappingEntry } from './mappingTypes';
import { InlineFieldWithPencilEdit } from './InlineFieldWithPencilEdit';
import { BackendMappingVariableField } from './BackendMappingVariableField';

export interface MappingRowFieldsProps {
  variant: 'backend' | 'interface';
  entry: MappingEntry | null;
  /** Parent node with children but no row at this path — compact visual spacers */
  groupOnlyBackend?: boolean;
  groupOnlyInterface?: boolean;
  /** Backend: when false, hide API field (variable only). */
  showApiFields?: boolean;
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
  onCreateOutputVariable?: (displayName: string) => { id: string; label: string } | null;
  onOutputVariableCreated?: () => void;
}

export function MappingRowFields({
  variant,
  entry,
  groupOnlyBackend,
  groupOnlyInterface,
  showApiFields = true,
  secondaryFieldsLocked = false,
  suppressFieldTabFocus = false,
  datalistApiId,
  datalistVarId,
  onPatch,
  backendColumn,
  variableOptions = [],
  onCreateOutputVariable,
  onOutputVariableCreated,
}: MappingRowFieldsProps) {
  if (variant === 'backend' && groupOnlyBackend) {
    return (
      <div className="flex items-center gap-2 shrink-0 opacity-30 pointer-events-none" aria-hidden>
        {showApiFields ? (
          <div className="h-7 w-[3.25rem] shrink-0 rounded border border-dashed border-slate-600/70" />
        ) : null}
        <div className="h-7 w-[3.25rem] shrink-0 rounded border border-slate-600/70" />
      </div>
    );
  }

  if (variant === 'interface' && groupOnlyInterface) {
    return (
      <div className="flex items-center gap-2 shrink-0 opacity-30 pointer-events-none" aria-hidden>
        <div className="h-7 w-[3.25rem] shrink-0 rounded border border-slate-600/70" />
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  if (variant === 'backend') {
    const varMode = backendColumn === 'receive' ? 'receive' : 'send';
    return (
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {showApiFields ? (
          <InlineFieldWithPencilEdit
            value={entry.apiField}
            placeholder="Campo API (opz.)"
            ariaLabel="Campo API (opzionale)"
            listId={datalistApiId}
            accent="sky"
            suppressFocus={secondaryFieldsLocked}
            viewTabIndex={suppressFieldTabFocus ? -1 : 0}
            onCommit={(next) => onPatch({ apiField: next })}
          />
        ) : null}
        {secondaryFieldsLocked ? (
          <InlineFieldWithPencilEdit
            value={entry.linkedVariable}
            placeholder="Variabile"
            ariaLabel="Variabile collegata"
            listId={datalistVarId}
            accent="amber"
            suppressFocus
            viewTabIndex={-1}
            onCommit={(next) => onPatch({ linkedVariable: next })}
          />
        ) : (
          <BackendMappingVariableField
            mode={varMode}
            value={entry.linkedVariable}
            variableRefId={entry.variableRefId}
            variableOptions={variableOptions}
            onCommit={(patch) => onPatch(patch)}
            onCreateVariable={varMode === 'receive' ? onCreateOutputVariable : undefined}
            onVariableCreated={varMode === 'receive' ? onOutputVariableCreated : undefined}
          />
        )}
      </div>
    );
  }

  return null;
}
