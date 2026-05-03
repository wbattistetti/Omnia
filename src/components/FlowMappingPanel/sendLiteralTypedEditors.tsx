/**
 * Editor letterali SEND (Backend Call): allineati ai tipi OpenAPI — data con Now/Tomorrow, number, time.
 */

import React from 'react';
import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import { htmlInputTypeForKind } from '../TaskEditor/EditorHost/editors/backendMockTable/InputRow';
import { DateSelectorPopover } from './DateSelectorPopover';

export function normalizeStartDateLiteral(raw: string): string {
  const t = raw.trim();
  if (/^now$/i.test(t)) return 'Now';
  if (/^tomorrow$/i.test(t)) return 'Tomorrow';
  return raw;
}

export function StartDateSendLiteralInput({
  value,
  onChange,
  onLiteralCommitted,
  onCalendarOpenChange,
  onDateCommitComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Dopo Applica / Oggi / Domani: valore normalizzato (persistenza mapping). */
  onLiteralCommitted?: (v: string) => void;
  onCalendarOpenChange?: (isOpen: boolean) => void;
  onDateCommitComplete?: () => void;
}) {
  return (
    <DateSelectorPopover
      value={value}
      onChange={(next) => onChange(normalizeStartDateLiteral(next))}
      onCommitted={
        onLiteralCommitted
          ? (next) => onLiteralCommitted(normalizeStartDateLiteral(next))
          : undefined
      }
      onCalendarOpenChange={onCalendarOpenChange}
      onDateCommitComplete={onDateCommitComplete}
      className="min-w-0 flex-1"
    />
  );
}

export type SendLiteralTypedEditorsProps = {
  kind: OpenApiInputUiKind | undefined;
  /** Nome parametro API (es. startDate) — abilita UI data estesa. */
  apiField?: string;
  value: string;
  onChange: (next: string) => void;
  /** Invocato quando il date picker conferma (non durante la digitazione). */
  onLiteralCommitted?: (next: string) => void;
  onCalendarOpenChange?: (isOpen: boolean) => void;
  /** Solo Applica / Oggi / Domani. */
  onDateCommitComplete?: () => void;
};

/**
 * Campo costante nel pannello SEND: input HTML coerente con il tipo OpenAPI.
 */
export function SendLiteralTypedEditors({
  kind,
  apiField,
  value,
  onChange,
  onLiteralCommitted,
  onCalendarOpenChange,
  onDateCommitComplete,
}: SendLiteralTypedEditorsProps) {
  const api = (apiField || '').trim();
  const useStartDateUi = api === 'startDate' || kind === 'date';

  if (useStartDateUi) {
    return (
      <StartDateSendLiteralInput
        value={value}
        onChange={onChange}
        onLiteralCommitted={onLiteralCommitted}
        onCalendarOpenChange={onCalendarOpenChange}
        onDateCommitComplete={onDateCommitComplete}
      />
    );
  }

  const htmlType = htmlInputTypeForKind(kind);
  return (
    <input
      type={htmlType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Costante (Invio)"
      title="Valore fisso inviato all’API se non scegli una variabile dall’elenco sotto"
      className="min-w-0 rounded border border-amber-400/40 bg-slate-900 px-2 py-1 text-[10px] text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60 box-border w-full"
    />
  );
}
