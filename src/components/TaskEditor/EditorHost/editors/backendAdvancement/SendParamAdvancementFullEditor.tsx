/**
 * Full advancement editor: tipo da contratto (sola lettura), NL, generazione script (Crea / Affina), DSL Monaco, test.
 * Allineato alla logica Create/Refine degli altri editor (es. estrattori).
 */

import React from 'react';
import MonacoEditor from 'react-monaco-editor';
import { AlertTriangle, FlaskConical, Sparkles } from 'lucide-react';
import { setupMonacoEnvironment } from '../../../../../utils/monacoWorkerSetup';
import {
  type BackendInputAdvancementEntry,
  isAdvancementNlScriptOutOfSync,
} from '../../../../../domain/advancement/backendAdvancementConfig';
import type { AdvancementValueType } from '../../../../../domain/advancement/advancementDsl';
import { validateAdvancementJsSyntax } from '../../../../../domain/advancement/advancementJsExpr';
import {
  type AdvancementPlayContextBundle,
  type AdvancementQuickTestRowState,
} from '../../../../../domain/advancement/advancementQuickTest';
import { translateAdvancementDsl } from '../../../../../services/advancementDslTranslateApi';
import { AdvancementQuickTestChips } from './AdvancementQuickTestChips';

try {
  setupMonacoEnvironment();
} catch {
  /* noop */
}

const NL_TEXTAREA_MAX_PX = 200;

export interface SendParamAdvancementFullEditorProps {
  wireKey: string;
  entry: BackendInputAdvancementEntry;
  /** Tipo risultato DSL: deriva dalla firma backend (OpenAPI), non modificabile qui. */
  paramType: AdvancementValueType;
  getPlayContext: (wireKey: string) => AdvancementPlayContextBundle;
  onPatch: (patch: Partial<BackendInputAdvancementEntry>) => void;
  buildSignature: () => { parameters: Record<string, { type: string; description: string }> };
  fieldDescriptionHint?: string;
  /** Test rapido: stesso stato chip della riga SEND (parent). */
  onRunAdvancementQuickTest: () => void;
  quickTestUi?: AdvancementQuickTestRowState;
}

export function SendParamAdvancementFullEditor({
  wireKey,
  entry,
  paramType,
  getPlayContext: _getPlayContext,
  onPatch,
  buildSignature,
  fieldDescriptionHint,
  onRunAdvancementQuickTest,
  quickTestUi,
}: SendParamAdvancementFullEditorProps) {
  const [translateBusy, setTranslateBusy] = React.useState(false);
  const [translateErr, setTranslateErr] = React.useState<string | null>(null);
  const nlTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const dslTrim = (entry.dslExpression || '').trim();
  /** Stesso criterio degli editor contract: niente script → Crea; script presente → Affina. */
  const isCreateScript = dslTrim.length === 0;

  const handleTranslate = React.useCallback(async () => {
    const nlt = (entry.naturalLanguage || '').trim();
    if (!nlt) {
      setTranslateErr('Scrivi prima una descrizione in linguaggio naturale.');
      return;
    }
    setTranslateBusy(true);
    setTranslateErr(null);
    try {
      const res = await translateAdvancementDsl({
        naturalLanguage: nlt,
        targetParam: wireKey,
        targetType: paramType,
        signature: buildSignature(),
        provider: 'groq',
      });
      if (!res.success || !res.dslExpression) {
        setTranslateErr(res.error || 'Traduzione fallita.');
        return;
      }
      try {
        validateAdvancementJsSyntax(res.dslExpression);
      } catch (e) {
        setTranslateErr(e instanceof Error ? e.message : 'Espressione non valida.');
        return;
      }
      const refined = res.refinedNaturalLanguage?.trim();
      const finalNl = refined && refined.length > 0 ? refined : nlt;
      const patch: Partial<BackendInputAdvancementEntry> = {
        dslExpression: res.dslExpression,
        naturalLanguageAlignedWithScript: finalNl,
        dslManuallyEditedAfterAlign: false,
      };
      if (refined && refined !== nlt) {
        patch.naturalLanguage = refined;
      }
      onPatch(patch);
    } finally {
      setTranslateBusy(false);
    }
  }, [buildSignature, entry.naturalLanguage, onPatch, paramType, wireKey]);

  const handleTest = React.useCallback(() => {
    if (!dslTrim) {
      return;
    }
    onRunAdvancementQuickTest();
  }, [dslTrim, onRunAdvancementQuickTest]);

  const nl = entry.naturalLanguage ?? '';
  React.useLayoutEffect(() => {
    const el = nlTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(NL_TEXTAREA_MAX_PX, el.scrollHeight);
    el.style.height = `${Math.max(36, next)}px`;
  }, [nl]);

  const cur = entry;
  const scriptButtonBusy = isCreateScript ? 'Creazione…' : 'Affinamento…';

  const scriptOutOfSync = isAdvancementNlScriptOutOfSync(cur);
  /** Affina visibile solo se c’è già uno script e serve riallineare (modifiche / task senza snapshot IA). */
  const showAffinaButton =
    !isCreateScript &&
    (scriptOutOfSync || entry.naturalLanguageAlignedWithScript === undefined);
  /** Evidenziazione forte: descrizione o Monaco diversi dall’ultimo Affina riuscito. */
  const affinaNeedsAttention = scriptOutOfSync;

  const nlTrimForDisabled = (entry.naturalLanguage || '').trim();
  const translateDisabled = translateBusy || !nlTrimForDisabled;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center rounded border border-slate-600/80 bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-slate-200/95"
          title="Tipo del parametro dalla firma API (OpenAPI / Read API). Non modificabile qui."
        >
          Tipo: <span className="ml-1 font-mono text-amber-200/90">{paramType}</span>
        </span>
        {isCreateScript ? (
          <button
            type="button"
            onClick={() => void handleTranslate()}
            disabled={translateDisabled}
            className="inline-flex items-center gap-1 rounded border border-violet-500/35 bg-violet-500/12 px-2 py-1 text-[11px] font-semibold text-violet-100 disabled:opacity-50"
            title="Genera lo script dalla descrizione in linguaggio naturale"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {translateBusy ? scriptButtonBusy : 'Crea script'}
          </button>
        ) : showAffinaButton ? (
          <button
            type="button"
            onClick={() => void handleTranslate()}
            disabled={translateDisabled}
            className={
              affinaNeedsAttention
                ? 'omnia-affina-button-blink inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/60 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-violet-900/50 disabled:opacity-50'
                : 'inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/18 px-2 py-1 text-[11px] font-semibold text-violet-100 disabled:opacity-50'
            }
            title={
              affinaNeedsAttention
                ? 'Descrizione o codice modificati: clicca per riallineare con l’IA'
                : 'Primo allineamento IA su questo script (task precedente) oppure rigenera'
            }
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {translateBusy ? scriptButtonBusy : 'Affina script'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleTest}
          disabled={!dslTrim}
          className="inline-flex items-center gap-1 rounded border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold text-emerald-100 disabled:opacity-40"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Test
        </button>
        <AdvancementQuickTestChips state={quickTestUi} />
      </div>
      <textarea
        ref={nlTextareaRef}
        value={nl}
        onChange={(e) => onPatch({ naturalLanguage: e.target.value })}
        rows={1}
        className="min-h-[36px] w-full resize-y max-h-[200px] overflow-y-auto rounded border border-slate-600/80 bg-slate-900/90 px-2 py-1.5 font-sans text-[11px] leading-snug text-slate-100 placeholder:text-slate-600"
        placeholder="Intento in linguaggio naturale…"
      />
      <div className="flex min-h-[120px] min-w-0 flex-1 gap-1.5">
        {scriptOutOfSync ? (
          <>
            <span className="sr-only">
              Modifiche non allineate allo script: usa Affina script nella barra sopra.
            </span>
            <span
              className="group relative mt-1 inline-flex shrink-0 cursor-help self-start"
              title="Modifiche non allineate allo script. Usa «Affina script» nella barra sopra."
              tabIndex={0}
              aria-label="Modifiche non allineate allo script. Usa Affina script nella barra sopra."
            >
              <AlertTriangle
                className="omnia-warning-triangle-blink h-4 w-4 text-amber-400"
                aria-hidden
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[min(240px,70vw)] -translate-x-1/2 rounded-md border border-slate-600/90 bg-slate-950/98 px-2 py-1.5 text-center text-[10px] leading-snug text-slate-100 opacity-0 shadow-xl ring-1 ring-black/30 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Modifiche non allineate allo script. Usa <span className="font-semibold text-amber-200/95">Affina script</span>{' '}
                nella barra sopra.
              </span>
            </span>
          </>
        ) : null}
        <div className="min-h-[120px] min-w-0 flex-1 overflow-hidden rounded border border-slate-600/70">
          <MonacoEditor
          height={140}
          language="plaintext"
          theme="vs-dark"
          value={cur.dslExpression ?? ''}
          onChange={(v) => {
            const next = (v ?? '').trim();
            if (!next) {
              onPatch({
                dslExpression: '',
                naturalLanguageAlignedWithScript: undefined,
                dslManuallyEditedAfterAlign: false,
              });
              return;
            }
            onPatch({ dslExpression: v ?? '', dslManuallyEditedAfterAlign: true });
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
        </div>
      </div>
      {translateErr ? <p className="text-[10px] text-red-300">{translateErr}</p> : null}
      {fieldDescriptionHint ? (
        <p className="text-[10px] text-slate-500" title={fieldDescriptionHint}>
          {fieldDescriptionHint}
        </p>
      ) : null}
    </div>
  );
}
