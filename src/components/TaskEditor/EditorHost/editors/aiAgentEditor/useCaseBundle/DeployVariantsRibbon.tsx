/**
 * Nastro card per ogni voce di `variants[]` nel JSON deploy (anteprima pannello JSON).
 */

import React from 'react';
import type { UseCaseConversationalVariantJson } from '@domain/useCaseGeneratorWizard/useCaseJsonProjection';
import { TokenizedHighlightedText } from '../useCaseGeneratorWizard/TokenizedHighlightedText';

export interface DeployVariantsRibbonProps {
  variants: readonly UseCaseConversationalVariantJson[];
}

export function DeployVariantsRibbon({
  variants,
}: DeployVariantsRibbonProps): React.ReactElement {
  if (variants.length === 0) {
    return (
      <p className="text-xs italic text-slate-500">Nessuna variante deployabile per questo use case.</p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-1">
      {variants.map((v, index) => (
        <article
          key={`${v.variantId}-${v.phraseId ?? index}`}
          className="rounded-lg border border-violet-600/35 bg-gradient-to-br from-violet-950/30 to-slate-950/80 p-2.5 shadow-sm"
        >
          <header className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-violet-900/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-100">
              {v.variantId}
            </span>
            {v.when ? (
              <span className="rounded border border-emerald-600/40 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] text-emerald-200">
                when: <span className="font-medium">{v.when}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">default · nessuna clausola when</span>
            )}
          </header>
          <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-slate-500">
            tokenizedExample
          </p>
          <div className="mb-2 rounded border border-slate-700/60 bg-slate-900/80 p-2">
            <TokenizedHighlightedText
              text={v.tokenizedExample}
              mode="runtime"
              className="text-xs leading-relaxed text-slate-100"
            />
          </div>
          {v.tokens.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {v.tokens.map((t) => (
                <span
                  key={t}
                  className="rounded border border-amber-500/35 bg-amber-950/25 px-1.5 py-0.5 font-mono text-[10px] text-amber-200"
                >
                  [{t}]
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-500">nessun token</span>
          )}
        </article>
      ))}
    </div>
  );
}
