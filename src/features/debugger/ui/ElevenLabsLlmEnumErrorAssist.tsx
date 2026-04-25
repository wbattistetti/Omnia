/**
 * Card assistenza: enum LLM da errore ElevenLabs ↔ catalogo sync ↔ `llmMapping.json` (per lingua).
 */

import React from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { CompilationError } from '@components/FlowCompiler/types';
import { executeNavigationIntent, resolveNavigationIntent } from '@domain/compileErrors';
import {
  extractLlmEnumQuotedIdsFromMessage,
  messageLooksLikeElevenLabsLlmEnumValidation,
} from '@domain/compileErrors/parseElevenLabsLlmEnumFromMessage';
import {
  CatalogApiError,
  fetchCatalogLanguages,
  fetchCatalogModels,
  fetchLlmMapping,
  postLlmMapping,
  type LlmMappingPayload,
} from '@services/iaCatalogApi';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import {
  mergeConvaiAgentIdFromGlobalDefaults,
  normalizeIAAgentConfig,
  parseOptionalIaRuntimeJson,
} from '@utils/iaAgentRuntime/iaAgentConfigNormalize';
import { loadGlobalIaAgentConfig } from '@utils/iaAgentRuntime/globalIaAgentPersistence';
import {
  effectiveAllowedForLocale,
  mergeNonEnLocalesFromCatalogAndMapping,
  primaryLang,
} from '@utils/iaCatalog/elevenLabsLlmMappingLocale';

function agentVoiceLanguageFromTask(taskId: string | undefined): string | null {
  if (!taskId?.trim()) return null;
  const task = taskRepository.getTask(taskId.trim());
  if (!task || task.type !== TaskType.AIAgent) return null;
  const globals = loadGlobalIaAgentConfig();
  const parsed = parseOptionalIaRuntimeJson(task.agentIaRuntimeOverrideJson);
  const merged = normalizeIAAgentConfig(parsed ?? globals);
  const cfg = mergeConvaiAgentIdFromGlobalDefaults(merged, globals);
  const lang = (cfg.voice?.language ?? '').trim();
  return lang || null;
}

function mergeMissingIntoLocale(
  mapping: LlmMappingPayload,
  locale: string,
  missing: string[]
): LlmMappingPayload {
  const next = JSON.parse(JSON.stringify(mapping)) as LlmMappingPayload;
  const cur = new Set(effectiveAllowedForLocale(next, locale));
  for (const id of missing) cur.add(id);
  const arr = [...cur].sort((a, b) => a.localeCompare(b));
  next.elevenlabs.perLanguage = { ...next.elevenlabs.perLanguage, [locale]: arr };
  return next;
}

export interface ElevenLabsLlmEnumErrorAssistProps {
  rawMessage: string;
  /** Errore compilazione originale (per navigazione FIX / configurazione). */
  sourceError: CompilationError;
  className?: string;
}

export function ElevenLabsLlmEnumErrorAssist({
  rawMessage,
  sourceError,
  className = '',
}: ElevenLabsLlmEnumErrorAssistProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [models, setModels] = React.useState<{ model_id: string; name: string }[]>([]);
  const [mapping, setMapping] = React.useState<LlmMappingPayload | null>(null);
  const [locales, setLocales] = React.useState<{ locale: string; label: string }[]>([]);
  const [selectedLocale, setSelectedLocale] = React.useState('it-IT');
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [saveNotice, setSaveNotice] = React.useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [saveBusy, setSaveBusy] = React.useState(false);

  const fromError = React.useMemo(() => extractLlmEnumQuotedIdsFromMessage(rawMessage), [rawMessage]);
  const catalogSet = React.useMemo(() => new Set(models.map((m) => m.model_id)), [models]);

  const recognized = React.useMemo(
    () => fromError.filter((id) => catalogSet.has(id)).sort((a, b) => a.localeCompare(b)),
    [fromError, catalogSet]
  );

  const notInCatalog = React.useMemo(
    () => fromError.filter((id) => !catalogSet.has(id)).sort((a, b) => a.localeCompare(b)),
    [fromError, catalogSet]
  );

  const allowedForLocale = React.useMemo(() => {
    if (!mapping) return [];
    return effectiveAllowedForLocale(mapping, selectedLocale);
  }, [mapping, selectedLocale]);

  const allowedSet = React.useMemo(() => new Set(allowedForLocale), [allowedForLocale]);

  const missingForMerge = React.useMemo(
    () => recognized.filter((id) => !allowedSet.has(id)),
    [recognized, allowedSet]
  );

  React.useEffect(() => {
    let c = false;
    setLoadErr(null);
    void (async () => {
      try {
        const [mods, langs, map] = await Promise.all([
          fetchCatalogModels('elevenlabs'),
          fetchCatalogLanguages('elevenlabs'),
          fetchLlmMapping(),
        ]);
        if (c) return;
        setModels(mods.map((m) => ({ model_id: m.model_id, name: m.name || m.model_id })));
        const nonEn = langs.languages.filter((l) => String(l.locale || '').trim() && primaryLang(l.locale) !== 'en');
        setLocales(mergeNonEnLocalesFromCatalogAndMapping(nonEn, map.elevenlabs.perLanguage ?? {}));
        setMapping(map);
      } catch (e) {
        if (c) return;
        setLoadErr(e instanceof CatalogApiError ? e.message : String(e));
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  React.useEffect(() => {
    const fromTask = agentVoiceLanguageFromTask(sourceError.taskId);
    if (!fromTask) return;
    const match = locales.some((l) => l.locale === fromTask);
    if (match) {
      setSelectedLocale(fromTask);
      return;
    }
    const primary = primaryLang(fromTask);
    const hit = locales.find((l) => primaryLang(l.locale) === primary);
    if (hit) setSelectedLocale(hit.locale);
  }, [locales, sourceError.taskId]);

  const onOpenConfig = React.useCallback(async () => {
    try {
      await executeNavigationIntent(resolveNavigationIntent(sourceError));
    } catch (e) {
      console.error('[ElevenLabsLlmEnumErrorAssist] open config failed:', e);
    }
  }, [sourceError]);

  const onMerge = React.useCallback(async () => {
    if (!mapping || missingForMerge.length === 0) return;
    setSaveBusy(true);
    setSaveNotice(null);
    try {
      const next = mergeMissingIntoLocale(mapping, selectedLocale, missingForMerge);
      await postLlmMapping(next);
      setMapping(next);
      setSaveNotice({ tone: 'success', message: 'Salvato correttamente.' });
    } catch (e) {
      const message =
        e instanceof CatalogApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Salvataggio fallito (serve OMNIA_WRITABLE_CONFIG=1 sul server Express).';
      setSaveNotice({ tone: 'error', message });
    } finally {
      setSaveBusy(false);
    }
  }, [mapping, missingForMerge, selectedLocale]);

  const previewLimit = 6;
  const previewIds = expanded ? recognized : recognized.slice(0, previewLimit);
  const hiddenCount = recognized.length - previewIds.length;

  if (!messageLooksLikeElevenLabsLlmEnumValidation(rawMessage)) return null;

  return (
    <div
      className={`mt-2 rounded-md border border-sky-600/40 bg-sky-950/25 dark:bg-sky-950/30 p-2 text-[11px] leading-snug text-slate-800 dark:text-slate-100 ${className}`}
    >
      <div className="font-semibold text-sky-900 dark:text-sky-100">
        Modelli LLM ElevenLabs rilevati dall&apos;errore
      </div>

      <div className="mt-1.5 space-y-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Elenco modelli trovati nell&apos;errore ({fromError.length})
        </div>
        {fromError.length === 0 ? (
          <p className="text-slate-500">Nessun id tra apici dopo «Input should be».</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-1">
              {previewIds.map((id) => (
                <li
                  key={id}
                  className="rounded-full border border-slate-300/80 bg-white/90 px-2 py-0.5 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-900/80"
                >
                  {id}
                </li>
              ))}
            </ul>
            {recognized.length > previewLimit ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-medium text-sky-700 hover:underline dark:text-sky-300"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {expanded ? 'Comprimi' : `Mostra tutti (${recognized.length})`}
                {!expanded && hiddenCount > 0 ? ` — nascosti ${hiddenCount}` : null}
              </button>
            ) : null}
          </>
        )}
      </div>

      {notInCatalog.length > 0 ? (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-950/20 px-1.5 py-1 text-[10px] text-amber-900 dark:text-amber-100">
          Non nel catalogo sync ({notInCatalog.length}):{' '}
          <span className="font-mono">{notInCatalog.slice(0, 8).join(', ')}</span>
          {notInCatalog.length > 8 ? '…' : null}. Esegui POST /api/ia-catalog/refresh se mancano modelli noti.
        </div>
      ) : null}

      <div className="mt-2 border-t border-sky-700/20 pt-2 dark:border-sky-500/20">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Confronto con configurazione attuale
        </div>
        {loadErr ? (
          <div className="mt-1 rounded border border-red-500/40 bg-red-950/30 px-1 py-0.5 text-red-100">
            {loadErr}
          </div>
        ) : null}
        {mapping ? (
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-px">
              <span className="text-[9px] text-slate-500">Lingua mapping</span>
              <select
                className="rounded border border-slate-400 bg-white px-1.5 py-1 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                value={selectedLocale}
                onChange={(e) => setSelectedLocale(e.target.value)}
              >
                {locales.map((l) => (
                  <option key={l.locale} value={l.locale}>
                    {l.label} ({l.locale})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {mapping && recognized.length > 0 ? (
          <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-slate-300/60 dark:border-slate-600/80">
            {recognized.map((id) => {
              const inCfg = allowedSet.has(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 border-b border-slate-200/80 px-2 py-1 font-mono text-[10px] last:border-b-0 dark:border-slate-700/80"
                >
                  <span className={inCfg ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {inCfg ? '✓' : '✗'}
                  </span>
                  <span>{id}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saveBusy || missingForMerge.length === 0 || !mapping}
          onClick={() => void onMerge()}
          className="rounded border border-violet-600/90 bg-violet-600/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saveBusy ? 'Salvataggio…' : 'Aggiungi modelli mancanti al file di configurazione'}
        </button>
        <button
          type="button"
          onClick={() => void onOpenConfig()}
          className="inline-flex items-center gap-1 rounded border border-slate-400 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ExternalLink className="h-3 w-3" />
          Apri configurazione IA (Fix)
        </button>
      </div>
      {saveNotice ? (
        <div
          role={saveNotice.tone === 'error' ? 'alert' : 'status'}
          className={
            saveNotice.tone === 'error'
              ? 'mt-1.5 rounded border border-red-500/50 bg-red-950/35 px-1.5 py-1 text-[10px] text-red-100 dark:bg-red-950/40'
              : 'mt-1.5 rounded border border-emerald-500/45 bg-emerald-950/30 px-1.5 py-1 text-[10px] text-emerald-100 dark:bg-emerald-950/35'
          }
        >
          {saveNotice.message}
        </div>
      ) : null}
    </div>
  );
}

export function shouldShowElevenLabsLlmEnumAssist(rawMessage: string, code?: string): boolean {
  return code === 'IaProvisionProviderError' && messageLooksLikeElevenLabsLlmEnumValidation(rawMessage);
}
