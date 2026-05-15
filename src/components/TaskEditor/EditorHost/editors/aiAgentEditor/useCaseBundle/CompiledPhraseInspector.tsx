/**
 * Pannello «Vedi compilato»: frase originale, tokenizzata, tabella mapping; scelta variante deploy.
 */

import React from 'react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { ensureUseCasePhrases } from '@domain/useCaseBundle/migrateUseCase';
import {
  compilePhraseVariant,
  variantNaturalText,
} from '@domain/useCaseBundle/semanticCompile';
import type { AIAgentPhraseVariant } from '@domain/useCaseBundle/schema';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import { TokenizedHighlightedText } from '../useCaseGeneratorWizard/TokenizedHighlightedText';

export interface CompiledPhraseInspectorProps {
  open: boolean;
  onClose: () => void;
  useCase: AIAgentUseCase | null;
  lexicon: ProjectSlotLexicon;
}

function variantOwnsTemplate(v: AIAgentPhraseVariant): boolean {
  return typeof v.naturalText === 'string' && v.naturalText.trim().length > 0;
}

function isExcludedFromDeploy(v: AIAgentPhraseVariant): boolean {
  return v.variantId !== 'default' && !variantOwnsTemplate(v);
}

export function CompiledPhraseInspector({
  open,
  onClose,
  useCase,
  lexicon,
}: CompiledPhraseInspectorProps): React.ReactElement | null {
  const uc = useCase ? ensureUseCasePhrases(useCase) : null;
  const phrase = uc?.phrases?.[0];
  const variants = phrase?.variants ?? [];

  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(
    () => variants[0]?.variantId ?? 'default'
  );

  React.useEffect(() => {
    if (!open || !phrase) return;
    const first = phrase.variants[0]?.variantId;
    if (first) setSelectedVariantId(first);
  }, [open, useCase?.id, phrase?.phraseId]);

  React.useEffect(() => {
    if (!phrase) return;
    if (!phrase.variants.some((v) => v.variantId === selectedVariantId)) {
      const f = phrase.variants[0]?.variantId;
      if (f) setSelectedVariantId(f);
    }
  }, [phrase, selectedVariantId]);

  if (!open || !useCase || !phrase || variants.length === 0) return null;

  const variant =
    phrase.variants.find((v) => v.variantId === selectedVariantId) ?? phrase.variants[0];
  if (!variant) return null;

  const excluded = isExcludedFromDeploy(variant);
  const naturalText = variantNaturalText(phrase, variant);
  const compiled =
    variant.compiled ?? compilePhraseVariant(phrase, variant, lexicon);
  const mappings = compiled.mappings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-600 bg-slate-900 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Vedi compilato — {useCase.label}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Chiudi
          </button>
        </div>

        {phrase.variants.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {phrase.variants.map((v) => {
              const active = v.variantId === selectedVariantId;
              const draft = isExcludedFromDeploy(v);
              return (
                <button
                  key={v.variantId}
                  type="button"
                  onClick={() => setSelectedVariantId(v.variantId)}
                  className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-emerald-500 bg-emerald-950/60 text-emerald-100'
                      : 'border-slate-600 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {v.variantId}
                  {draft ? (
                    <span className="ml-1 text-[10px] font-normal text-amber-400/90">bozza</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {excluded ? (
          <div className="mb-3 rounded border border-amber-700/60 bg-amber-950/35 px-2 py-1.5 text-[11px] text-amber-100/95">
            Template variante vuoto: nel prompt deploy questa variante strutturale è omessa (non si
            duplica il default). La preview sotto usa comunque il canonico della frase per il compile.
          </div>
        ) : null}

        <p className="mb-1 text-xs font-medium text-slate-400">Frase originale (surface)</p>
        <p className="mb-3 rounded bg-slate-800/80 p-2 font-mono text-sm text-slate-200">
          {naturalText || (
            <span className="text-slate-500">(vuota)</span>
          )}
        </p>

        <p className="mb-1 text-xs font-medium text-slate-400">Frase con slot tipizzati</p>
        <p className="mb-3 rounded bg-slate-800/80 p-2 text-sm">
          <TokenizedHighlightedText text={compiled.tokenizedText} />
        </p>

        <p className="mb-1 text-xs font-medium text-slate-400">Mapping surface → slot_id</p>
        <table className="mb-3 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-1 pr-2">surface</th>
              <th className="py-1">slot_id</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-2 text-slate-500">
                  Nessun bracket nella frase.
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={`${m.surface}-${m.slot_id}`} className="border-b border-slate-800">
                  <td className="py-1 pr-2 font-mono text-amber-200/90">{m.surface}</td>
                  <td className="py-1 font-mono text-emerald-300/90">[{m.slot_id}]</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p className="text-xs text-slate-500">
          Stato compile:{' '}
          <span
            className={compiled.status === 'stale' ? 'text-orange-400' : 'text-emerald-400'}
          >
            {compiled.status}
          </span>
          {' · '}
          variantId: {variant.variantId}
          {variant.when ? ` · when: ${variant.when}` : ''}
        </p>
      </div>
    </div>
  );
}
