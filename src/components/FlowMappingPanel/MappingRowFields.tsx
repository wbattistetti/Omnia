/**
 * Per-row field strip: backend (API + variable) or interface (external only).
 * Inputs use autosize width (content-sized), no shared column minWidth.
 */

import React from 'react';
import type { MappingEntry } from './mappingTypes';
import { AutosizeOneLineInput } from './AutosizeOneLineInput';

export interface MappingRowFieldsProps {
  variant: 'backend' | 'interface';
  entry: MappingEntry | null;
  /** Parent node with children but no row at this path — compact visual spacers */
  groupOnlyBackend?: boolean;
  groupOnlyInterface?: boolean;
  /** Backend: when false, hide API field (variable only). */
  showApiFields?: boolean;
  datalistApiId: string;
  datalistVarId: string;
  onPatch: (patch: Partial<MappingEntry>) => void;
}

const mirror10 = 'text-[10px] px-2 py-1 font-normal';

export function MappingRowFields({
  variant,
  entry,
  groupOnlyBackend,
  groupOnlyInterface,
  showApiFields = true,
  datalistApiId,
  datalistVarId,
  onPatch,
}: MappingRowFieldsProps) {
  const inputBase =
    'rounded text-[10px] bg-slate-950/60 ' +
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50';

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
    return (
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {showApiFields ? (
          <AutosizeOneLineInput
            mirrorClassName={mirror10}
            inputClassName={`${inputBase} border border-dashed border-sky-500/50 text-sky-200/90 placeholder:text-slate-500`}
            maxWidthClassName="max-w-[min(16rem,92vw)]"
            minChars={3}
            list={datalistApiId}
            placeholder="Campo API"
            value={entry.apiField}
            onChange={(e) => onPatch({ apiField: e.target.value })}
          />
        ) : null}
        <AutosizeOneLineInput
          mirrorClassName={mirror10}
          inputClassName={`${inputBase} border border-amber-600/60 text-amber-100/90 placeholder:text-slate-500`}
          maxWidthClassName="max-w-[min(16rem,92vw)]"
          minChars={3}
          list={datalistVarId}
          placeholder="Variabile"
          value={entry.linkedVariable}
          onChange={(e) => onPatch({ linkedVariable: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0 min-w-0">
      <AutosizeOneLineInput
        mirrorClassName={mirror10}
        inputClassName={`${inputBase} border border-amber-600/60 text-amber-100/90 placeholder:text-slate-500`}
        maxWidthClassName="max-w-[min(16rem,92vw)]"
        minChars={3}
        placeholder="Nome esterno"
        value={entry.externalName}
        onChange={(e) => onPatch({ externalName: e.target.value })}
      />
    </div>
  );
}
