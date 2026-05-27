/**
 * Icona stato parametro: mandatory (✓ verde), optional/derived (○ tratteggiato), unused (✗), missing (⚠).
 */

import React from 'react';
import { AlertTriangle, Check, CircleDashed, X, type LucideIcon } from 'lucide-react';
import type { BackendParameterKind } from '@domain/backendAnalysis/backendAnalysisDocumentV2';

const ICON = 'h-3.5 w-3.5 shrink-0';

type IconConfig = { Icon: LucideIcon; className: string; title: string };

const CONFIG: Record<BackendParameterKind, IconConfig> = {
  required: {
    Icon: Check,
    className: 'text-emerald-400',
    title: 'Obbligatorio',
  },
  optional: {
    Icon: CircleDashed,
    className: 'text-amber-300/90',
    title: 'Opzionale',
  },
  derived: {
    Icon: CircleDashed,
    className: 'text-sky-400/90',
    title: 'Derivato',
  },
  unused: {
    Icon: X,
    className: 'text-slate-500',
    title: 'Non necessario in questa fase',
  },
  missing: {
    Icon: AlertTriangle,
    className: 'text-amber-400',
    title: 'Binding mancante',
  },
};

export function BackendParameterKindIcon({
  kind,
}: {
  kind: BackendParameterKind;
}): React.ReactElement {
  const cfg = CONFIG[kind] ?? CONFIG.required;
  const { Icon } = cfg;
  return (
    <span className="inline-flex items-center justify-center" title={cfg.title}>
      <Icon className={`${ICON} ${cfg.className}`} aria-hidden strokeWidth={2.25} />
    </span>
  );
}
