/**
 * Card assistenza errori enum LLM ElevenLabs: messaggio chiaro + elenco modelli ammessi (stile debugger).
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CompilationError } from '@components/FlowCompiler/types';
import {
  extractInvalidLlmInputFromProvisionMessage,
  extractLlmEnumQuotedIdsFromMessage,
  messageLooksLikeElevenLabsLlmEnumValidation,
} from '@domain/compileErrors/parseElevenLabsLlmEnumFromMessage';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { resolveTaskIaConfig } from '@utils/iaAgentRuntime/resolveTaskIaConfig';

function formatLanguageLabelIt(code: string): string {
  const c = String(code || '').trim();
  if (!c) return '—';
  try {
    const dn = new Intl.DisplayNames(['it'], { type: 'language' });
    const label = dn.of(c);
    if (label) {
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  } catch {
    /* ignore */
  }
  return c;
}

function resolveLlmModelFromTask(taskId: string | undefined): string | null {
  if (!taskId?.trim()) return null;
  const task = taskRepository.getTask(taskId.trim());
  if (!task || task.type !== TaskType.AIAgent) return null;
  const cfg = resolveTaskIaConfig(task);
  const adv = cfg.advanced;
  if (!adv || typeof adv !== 'object' || Array.isArray(adv)) return null;
  const llm = (adv as Record<string, unknown>).llm;
  if (!llm || typeof llm !== 'object' || Array.isArray(llm)) return null;
  const m = (llm as Record<string, unknown>).model;
  if (typeof m === 'string' && m.trim()) return m.trim();
  return null;
}

function voiceLanguageFromTask(taskId: string | undefined): string | null {
  if (!taskId?.trim()) return null;
  const task = taskRepository.getTask(taskId.trim());
  if (!task || task.type !== TaskType.AIAgent) return null;
  const cfg = resolveTaskIaConfig(task);
  const lang = (cfg.voice?.language ?? '').trim();
  return lang || null;
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
  const validIds = React.useMemo(
    () => extractLlmEnumQuotedIdsFromMessage(rawMessage).sort((a, b) => a.localeCompare(b)),
    [rawMessage]
  );

  const { modelQuoted, langQuoted } = React.useMemo(() => {
    const fromErr = extractInvalidLlmInputFromProvisionMessage(rawMessage);
    const fromTask = resolveLlmModelFromTask(sourceError.taskId);
    const model = fromErr ?? fromTask ?? null;
    const langCode = voiceLanguageFromTask(sourceError.taskId);
    return {
      modelQuoted: model ?? '—',
      langQuoted: langCode ? formatLanguageLabelIt(langCode) : '—',
    };
  }, [rawMessage, sourceError.taskId]);

  const previewLimit = 6;
  const previewIds = expanded ? validIds : validIds.slice(0, previewLimit);
  const hiddenCount = validIds.length - previewIds.length;

  if (!messageLooksLikeElevenLabsLlmEnumValidation(rawMessage)) return null;

  return (
    <div className={`mt-1 space-y-2 ${className}`}>
      <p className="text-[11px] italic leading-snug text-gray-900 dark:text-white">
        Il modello LLM «{modelQuoted}» non è valido per la lingua «{langQuoted}». Seleziona uno di questi
        modelli:
      </p>

      <div className="space-y-1.5">
        {validIds.length === 0 ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Nessun id tra apici dopo «Input should be» nel messaggio di errore.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-1">
              {previewIds.map((id) => (
                <li
                  key={id}
                  className="rounded-full border border-amber-400/55 bg-amber-950/20 px-2 py-0.5 font-mono text-[10px] text-amber-100 dark:border-amber-400/45 dark:bg-amber-950/30"
                >
                  {id}
                </li>
              ))}
            </ul>
            {validIds.length > previewLimit ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-medium text-cyan-500 hover:underline dark:text-cyan-400"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                {expanded ? 'Comprimi' : `Mostra tutti (${validIds.length})`}
                {!expanded && hiddenCount > 0 ? ` — nascosti ${hiddenCount}` : null}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function shouldShowElevenLabsLlmEnumAssist(rawMessage: string, code?: string): boolean {
  return code === 'IaProvisionProviderError' && messageLooksLikeElevenLabsLlmEnumValidation(rawMessage);
}
