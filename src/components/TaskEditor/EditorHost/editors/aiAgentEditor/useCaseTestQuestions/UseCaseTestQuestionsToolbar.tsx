/**
 * Toolbar: generazione domande di test + cruscotto KPI (Validate / OK / KO).
 */

import React from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { useAIProvider } from '@context/AIProviderContext';
import { AI_CALL_PURPOSE } from '@domain/aiCalls/purposes';
import { generateUseCaseTestQuestionsApi } from '@services/aiAgentDesignApi';
import {
  appendUniqueTestQuestions,
  newUseCaseTestQuestionId,
} from '@domain/aiAgentUseCase/useCaseTestQuestions';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import {
  useUseCaseWizardListToolbarOptional,
  type TestQuestionLens,
} from '../useCaseGeneratorWizard/UseCaseWizardListToolbarContext';
import { useOptionalAIAgentEditorDock } from '../AIAgentEditorDockContext';

function KpiPill({
  label,
  pct,
  active,
  disabled,
  tone,
  onClick,
  title,
}: {
  label: string;
  pct: number;
  active: boolean;
  disabled?: boolean;
  tone: 'slate' | 'emerald' | 'red';
  onClick?: () => void;
  title: string;
}): React.ReactElement {
  const toneClass =
    tone === 'emerald'
      ? active
        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
        : 'border-emerald-500/25 text-emerald-300/90 hover:bg-emerald-500/10'
      : tone === 'red'
        ? active
          ? 'border-red-400/60 bg-red-500/20 text-red-100'
          : 'border-red-500/25 text-red-300/90 hover:bg-red-500/10'
        : active
          ? 'border-slate-400/50 bg-slate-700/40 text-slate-100'
          : 'border-slate-600/30 text-slate-400';

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/80 disabled:cursor-not-allowed disabled:opacity-40',
        toneClass,
      ].join(' ')}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-90">{pct}%</span>
    </button>
  );
}

export function UseCaseTestQuestionsToolbar(): React.ReactElement | null {
  const ctx = useUseCaseWizardListToolbarOptional();
  const dock = useOptionalAIAgentEditorDock();
  const { provider, model } = useAIProvider();

  if (!ctx) return null;

  const {
    testQuestionStats,
    testQuestionLens,
    toggleTestQuestionLens,
    triggerGenerateTestQuestions,
    generateTestQuestionsBusy,
  } = ctx;

  const stats = testQuestionStats;
  const canGenerate = Boolean(provider && model && dock);
  const busy = generateTestQuestionsBusy;
  const showKpiCruscotto = stats.total > 0;
  const generateTitle =
    busy && ctx.testQuestionsNotice?.startsWith('Generazione')
      ? ctx.testQuestionsNotice
      : 'Genera domande di test per tutti gli use case del catalogo';

  const onLens = (lens: TestQuestionLens) => {
    if (stats.total === 0) return;
    toggleTestQuestionLens(lens);
  };

  return (
    <div
      className="inline-flex shrink-0 items-center gap-1.5"
      role="group"
      aria-label="Domande di test use case"
    >
      <button
        type="button"
        disabled={!canGenerate || busy}
        title={generateTitle}
        onClick={() => void triggerGenerateTestQuestions()}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-200/20 bg-slate-100/95 px-2.5 text-[11px] font-semibold text-slate-900 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-500/40 dark:bg-slate-100/90"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <FlaskConical size={14} aria-hidden />
        )}
        <span>Genera Domande di Test</span>
      </button>

      {showKpiCruscotto ? (
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-600/25 bg-slate-900/40 p-0.5">
          <KpiPill
            label="Validate"
            pct={stats.reviewedPct}
            active={false}
            disabled
            tone="slate"
            title="Percentuale domande già revisionate (OK o KO)"
          />
          <KpiPill
            label="OK"
            pct={stats.okPct}
            active={testQuestionLens === 'ok'}
            disabled={stats.ok === 0}
            tone="emerald"
            onClick={() => onLens('ok')}
            title="Espandi ed evidenzia domande OK (clic di nuovo per uscire)"
          />
          <KpiPill
            label="KO"
            pct={stats.koPct}
            active={testQuestionLens === 'ko'}
            disabled={stats.ko === 0}
            tone="red"
            onClick={() => onLens('ko')}
            title="Espandi ed evidenzia domande KO (clic di nuovo per uscire)"
          />
        </div>
      ) : null}
    </div>
  );
}

export function buildGenerateTestQuestionsHandler(params: {
  getUseCases: () => readonly AIAgentUseCase[];
  setUseCases: React.Dispatch<React.SetStateAction<AIAgentUseCase[]>>;
  provider: string;
  model: string;
  buildCallMeta: (purpose: string) => AiCallMeta;
  outputLanguage: string;
  /** Solo avanzamento generazione (tooltip pulsante); niente testo sotto toolbar. */
  onProgress?: (message: string | null) => void;
}): () => Promise<void> {
  return async () => {
    const all = params.getUseCases();
    if (all.length === 0) {
      console.warn('[useCaseTestQuestions] Nessuno use case nel catalogo.');
      return;
    }
    if (!params.provider || !params.model) {
      console.warn('[useCaseTestQuestions] Configura provider e modello IA.');
      return;
    }

    params.onProgress?.(null);

    let addedTotal = 0;
    let skippedDuplicate = 0;
    let failed = 0;
    const failures: string[] = [];

    for (let i = 0; i < all.length; i++) {
      const uc = all[i]!;
      params.onProgress?.(`Generazione ${i + 1}/${all.length}: ${uc.label || uc.id}…`);

      try {
        const { test_questions } = await generateUseCaseTestQuestionsApi({
          useCase: uc,
          existingTestQuestions: uc.testQuestions ?? [],
          provider: params.provider,
          model: params.model,
          outputLanguage: params.outputLanguage,
          callMeta: params.buildCallMeta(AI_CALL_PURPOSE.USE_CASE_GENERATE_TEST_QUESTIONS),
        });
        const now = new Date().toISOString();
        const incoming = test_questions.map((row) => ({
          id: newUseCaseTestQuestionId(),
          text: row.text,
          expectedAnswer: row.expectedAnswer,
          status: 'pending' as const,
          ...(row.kind ? { kind: row.kind } : {}),
          createdAt: now,
        }));

        let addedForUc = 0;
        params.setUseCases((prev) =>
          prev.map((u) => {
            if (u.id !== uc.id) return u;
            const merged = appendUniqueTestQuestions(u.testQuestions ?? [], incoming);
            addedForUc = merged.length - (u.testQuestions ?? []).length;
            if (addedForUc === 0) return u;
            return { ...u, testQuestions: merged };
          })
        );

        if (addedForUc === 0) {
          skippedDuplicate += 1;
        } else {
          addedTotal += addedForUc;
        }
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${uc.label || uc.id}: ${msg}`);
      }
    }

    params.onProgress?.(null);

    if (addedTotal > 0) {
      if (failed > 0 && failures.length > 0) {
        console.warn('[useCaseTestQuestions] Generazione parziale:', failures.join('; '));
      }
      return;
    }

    if (failed === all.length) {
      console.warn(
        '[useCaseTestQuestions]',
        failures[0] ?? 'Generazione fallita per tutti gli use case.'
      );
      return;
    }

    if (skippedDuplicate > 0) {
      console.warn('[useCaseTestQuestions] Nessuna nuova domanda (tutte duplicate o già coperte).');
    } else {
      console.warn('[useCaseTestQuestions] Nessuna domanda generata.');
    }
  };
}
