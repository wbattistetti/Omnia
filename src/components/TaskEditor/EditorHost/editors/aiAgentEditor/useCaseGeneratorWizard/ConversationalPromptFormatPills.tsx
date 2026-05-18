/**
 * Pillole formato catalogo nel dialog «Prompt conversazionale»: switch schema + confronto token.
 */

import React from 'react';
import {
  CONVERSATIONAL_CATALOG_FORMAT_OPTIONS,
  type ConversationalCatalogFormat,
} from '@domain/useCaseGeneratorWizard/catalogFormat';
import type { ConversationalPromptFormatSizes } from '@domain/useCaseGeneratorWizard/buildConversationalPromptFormatSizes';
import {
  formatCatalogComparisonLabel,
  formatCompactCount,
} from '@domain/useCaseGeneratorWizard/promptTextMetrics';

export interface ConversationalPromptFormatPillsProps {
  value: ConversationalCatalogFormat;
  onChange: (format: ConversationalCatalogFormat) => void;
  formatSizes: ConversationalPromptFormatSizes | null;
}

export function ConversationalPromptFormatPills({
  value,
  onChange,
  formatSizes,
}: ConversationalPromptFormatPillsProps): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label="Schema output catalogo"
      className="flex flex-wrap items-center gap-1"
    >
      {CONVERSATIONAL_CATALOG_FORMAT_OPTIONS.map((opt) => {
        const entry = formatSizes?.[opt.id];
        const active = value === opt.id;
        const catalogHint = entry
          ? formatCatalogComparisonLabel(entry.catalog, entry.catalogTokenSavingsPercentVsPretty)
          : null;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.description}
            onClick={() => onChange(opt.id)}
            className={[
              'rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-tight transition-colors',
              active
                ? 'border-violet-400 bg-violet-600 text-white shadow-sm'
                : 'border-slate-600 bg-slate-800/90 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
            ].join(' ')}
          >
            <span>{opt.pillLabel}</span>
            {catalogHint ? (
              <span
                className={active ? 'font-normal text-violet-100/90' : 'font-normal text-slate-400'}
              >
                {' '}
                {catalogHint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Riga riepilogo verbosità per lo schema attivo. */
export function ConversationalPromptVerbositySummary({
  formatSizes,
  activeFormat,
}: {
  formatSizes: ConversationalPromptFormatSizes | null;
  activeFormat: ConversationalCatalogFormat;
}): React.ReactElement | null {
  const entry = formatSizes?.[activeFormat];
  const baseline = formatSizes?.['json-pretty'];
  if (!entry) return null;

  const catalogPct =
    activeFormat === 'json-pretty' || !baseline
      ? null
      : entry.catalogTokenSavingsPercentVsPretty;

  return (
    <p className="text-xs leading-relaxed text-slate-400">
      <span className="font-medium text-slate-300">Riepilogo schema attivo — </span>
      catalogo: ~{formatCompactCount(entry.catalog.estimatedTokens)} tok
      {catalogPct !== null ? (
        <span>
          {' '}
          ({catalogPct >= 0 ? '−' : '+'}
          {Math.abs(catalogPct)}% vs JSON completo)
        </span>
      ) : (
        <span> (baseline)</span>
      )}
      {' · '}
      prompt intero: ~{formatCompactCount(entry.total.estimatedTokens)} tok (
      {formatCompactCount(entry.total.wordCount)} parole,{' '}
      {formatCompactCount(entry.total.charCount)} caratteri)
    </p>
  );
}
