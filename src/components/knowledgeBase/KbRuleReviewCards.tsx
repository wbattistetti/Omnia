/**
 * Nested macro/micro accordions for KB phase-B rule review with status cycle and include checkbox.
 */

import React from 'react';
import type { KbInducedRule, KbRuleStatus } from '@domain/knowledgeBase/kbRuleTypes';
import { confidenceBlocksPromotion } from '@domain/knowledgeBase/kbAnalysisSession';
import {
  buildKbRuleForest,
  getKbRuleReviewVisualState,
  isKbMacroRule,
  type KbRuleReviewVisualState,
} from '@domain/knowledgeBase/kbRuleHierarchy';
import { isKbRuleStatusClosed } from '@domain/knowledgeBase/kbRuleStatus';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  CornerDownRight,
  FileText,
  Layers,
  Loader2,
} from 'lucide-react';
import { KbRuleStatusControl } from './KbRuleStatusControl';

export type KbRuleReviewCardsProps = {
  rules: readonly KbInducedRule[];
  currentRuleId: string | null;
  disabled?: boolean;
  onFocusRule: (ruleId: string) => void;
  onSetRuleStatus: (ruleId: string, status: KbRuleStatus) => void;
  onPatchRule: (ruleId: string, patch: Partial<KbInducedRule>) => void;
  onConfirmAllHigh?: () => void;
  openRuleCount?: number;
  opaqueSurface?: boolean;
};

/** Macro / macro-body / micro backgrounds — same family, increasing emphasis inward. */
function ruleReviewSurfaces(opaque: boolean) {
  if (opaque) {
    return {
      macro: 'bg-slate-900',
      macroBody: 'bg-slate-800/90',
      micro: 'bg-slate-800/65',
      atomic: 'bg-slate-900',
    };
  }
  return {
    macro: 'bg-slate-900/55',
    macroBody: 'bg-slate-800/50',
    micro: 'bg-slate-800/35',
    atomic: 'bg-slate-900/50',
  };
}

function RuleKindIcon({ rule }: { rule: KbInducedRule }): React.ReactElement {
  const cls = 'h-3.5 w-3.5 shrink-0';
  if (isKbMacroRule(rule)) {
    return <Layers className={cls + ' text-violet-300/90'} aria-hidden title="Macro-regola" />;
  }
  if (rule.ruleKind === 'micro') {
    return (
      <CornerDownRight className={cls + ' text-slate-400'} aria-hidden title="Esempio" />
    );
  }
  return <FileText className={cls + ' text-slate-500'} aria-hidden title="Regola" />;
}

function confidenceTitle(confidence: KbInducedRule['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'Confidenza IA: alta — estrazione ritenuta affidabile';
    case 'low':
      return 'Confidenza IA: bassa — verifica con attenzione';
    default:
      return 'Confidenza IA: media — verifica prima di chiudere la regola';
  }
}

function ReviewStateIcon({ state }: { state: KbRuleReviewVisualState }): React.ReactElement {
  if (state === 'in_review') {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300" aria-hidden />;
  }
  if (state === 'closed') {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" aria-hidden />;
  }
  return <Circle className="h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-hidden />;
}

type RuleHeaderProps = {
  rule: KbInducedRule;
  disabled: boolean;
  onSetRuleStatus: (id: string, status: KbRuleStatus) => void;
  onPatchRule: (id: string, patch: Partial<KbInducedRule>) => void;
};

function RuleAccordionHeader({
  rule,
  disabled,
  onSetRuleStatus,
  onPatchRule,
}: RuleHeaderProps): React.ReactElement {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      <label
        className="inline-flex items-center gap-1 text-[10px] text-slate-400"
        title="Se deselezionata, la regola non entra in promozione use case"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={rule.included !== false}
          disabled={disabled}
          onChange={(e) => onPatchRule(rule.id, { included: e.target.checked })}
          className="rounded border-slate-600"
          aria-label={rule.included !== false ? 'Escludi regola' : 'Includi regola'}
        />
        Inclusa
      </label>
      <KbRuleStatusControl
        status={rule.status}
        disabled={disabled}
        onCycle={(next) => onSetRuleStatus(rule.id, next)}
      />
      <span
        className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400"
        title={confidenceTitle(rule.confidence)}
      >
        {rule.confidence}
      </span>
      {confidenceBlocksPromotion(rule.confidence) && rule.status === 'hypothesized' ? (
        <span
          className="text-[10px] text-amber-400"
          title="Confidenza non alta: valida esplicitamente prima di promuovere"
        >
          da validare
        </span>
      ) : null}
    </div>
  );
}

function RuleBody({
  rule,
  disabled,
  onPatchRule,
}: {
  rule: KbInducedRule;
  disabled: boolean;
  onPatchRule: (id: string, patch: Partial<KbInducedRule>) => void;
}): React.ReactElement {
  const fieldClass =
    'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-50';
  const ruleLabel = isKbMacroRule(rule) ? 'Regola (generalizzazione)' : 'Regola';
  return (
    <>
      <label className="mt-1 block text-[10px] text-slate-500">{ruleLabel}</label>
      <textarea
        rows={isKbMacroRule(rule) ? 3 : 2}
        disabled={disabled}
        value={rule.rule}
        onChange={(e) => onPatchRule(rule.id, { rule: e.target.value })}
        className={fieldClass}
        placeholder={
          isKbMacroRule(rule)
            ? 'Pattern generale che riassume gli esempi sotto (non copiare un singolo esempio)'
            : undefined
        }
      />
      <RuleEvidenceSection rule={rule} disabled={disabled} onPatchRule={onPatchRule} />
    </>
  );
}

function RuleEvidenceSection({
  rule,
  disabled,
  onPatchRule,
}: {
  rule: KbInducedRule;
  disabled: boolean;
  onPatchRule: (id: string, patch: Partial<KbInducedRule>) => void;
}): React.ReactElement {
  const [open, setOpen] = React.useState(Boolean(rule.evidence?.trim()));
  const fieldClass =
    'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-50';
  const hasText = Boolean(rule.evidence?.trim());

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-left text-[10px] font-medium text-slate-400 hover:text-slate-200"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        )}
        Evidenza documento
        {hasText ? (
          <span className="font-normal text-slate-500">(riferimento IA)</span>
        ) : (
          <span className="font-normal text-slate-600">— opzionale</span>
        )}
      </button>
      {open ? (
        <div className="mt-1 rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1.5">
          <p className="mb-1 text-[10px] leading-snug text-slate-500">
            Testo proposto dall&apos;analisi; verifica nel tab Documento. Non è ancora un link al
            punto esatto nel file.
          </p>
          <textarea
            rows={3}
            disabled={disabled}
            value={rule.evidence}
            onChange={(e) => onPatchRule(rule.id, { evidence: e.target.value })}
            className={fieldClass + ' mt-0'}
            placeholder="Estratto o elenco dal documento KB…"
          />
        </div>
      ) : null}
    </div>
  );
}

function RuleFooterActions({
  rule,
  disabled,
  onFocusRule,
}: {
  rule: KbInducedRule;
  disabled: boolean;
  onFocusRule: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFocusRule(rule.id)}
        className="rounded border border-slate-600 px-1.5 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        Focus chat
      </button>
      {isKbMacroRule(rule) ? (
        <span className="ml-2 text-[10px] text-slate-500">Valida gli esempi sotto</span>
      ) : null}
    </div>
  );
}

type MicroRuleRowProps = {
  rule: KbInducedRule;
  currentRuleId: string | null;
  disabled: boolean;
  open: boolean;
  microSurface: string;
  onToggle: () => void;
  onFocusRule: (id: string) => void;
  onSetRuleStatus: (id: string, status: KbRuleStatus) => void;
  onPatchRule: (id: string, patch: Partial<KbInducedRule>) => void;
};

function ruleHeaderPreview(rule: KbInducedRule): string | null {
  const title = (rule.title || rule.field || '').trim();
  const body = rule.rule.trim();
  if (!body || body === title) return null;
  return body;
}

function MicroRuleRow({
  rule,
  currentRuleId,
  disabled,
  open,
  microSurface,
  onToggle,
  onFocusRule,
  onSetRuleStatus,
  onPatchRule,
}: MicroRuleRowProps): React.ReactElement {
  const visual = getKbRuleReviewVisualState(rule, currentRuleId);
  const focused = rule.id === currentRuleId;
  const preview = open ? null : ruleHeaderPreview(rule);

  return (
    <li
      className={
        'ml-2 text-sm rounded-md border ' +
        (focused
          ? 'border-violet-500/70 bg-violet-950/30 ring-1 ring-violet-500/30'
          : 'border-slate-700/60 ' + microSurface)
      }
    >
      <div className="flex items-start gap-0.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
          aria-expanded={open}
        >
          <RuleKindIcon rule={rule} />
          <ReviewStateIcon state={visual} />
          {open ? (
            <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-100">
              {rule.title || rule.field}
            </span>
            {preview ? (
              <span className="mt-0.5 block line-clamp-1 text-xs text-slate-500">{preview}</span>
            ) : null}
          </span>
        </button>
        <div className="shrink-0 py-1 pr-1" onClick={(e) => e.stopPropagation()}>
          <KbRuleStatusControl
            status={rule.status}
            disabled={disabled}
            onCycle={(next) => onSetRuleStatus(rule.id, next)}
            className="border-0 bg-transparent px-0.5"
          />
        </div>
      </div>
      {open ? (
        <div className="border-t border-slate-800/80 px-2 pb-2 pt-1">
          <RuleAccordionHeader
            rule={rule}
            disabled={disabled}
            onSetRuleStatus={onSetRuleStatus}
            onPatchRule={onPatchRule}
          />
          <RuleBody rule={rule} disabled={disabled} onPatchRule={onPatchRule} />
          <RuleFooterActions rule={rule} disabled={disabled} onFocusRule={onFocusRule} />
        </div>
      ) : null}
    </li>
  );
}

export function KbRuleReviewCards({
  rules,
  currentRuleId,
  disabled = false,
  onFocusRule,
  onSetRuleStatus,
  onPatchRule,
  onConfirmAllHigh,
  openRuleCount = 0,
  opaqueSurface = false,
}: KbRuleReviewCardsProps): React.ReactElement {
  const surfaces = ruleReviewSurfaces(opaqueSurface);
  const forest = React.useMemo(() => buildKbRuleForest(rules), [rules]);
  const [openMacroIds, setOpenMacroIds] = React.useState<Set<string>>(() => new Set());
  const [openMicroIds, setOpenMicroIds] = React.useState<Set<string>>(() => new Set());

  const visible = rules.filter((r) => !r.deleted);
  const highOpen = visible.filter(
    (r) =>
      r.confidence === 'high' &&
      !isKbRuleStatusClosed(r.status) &&
      !isKbMacroRule(r)
  );

  React.useEffect(() => {
    if (!currentRuleId) return;
    const current = rules.find((r) => r.id === currentRuleId);
    if (!current) return;
    if (current.parentRuleId) {
      setOpenMacroIds((prev) => new Set(prev).add(current.parentRuleId!));
      setOpenMicroIds((prev) => new Set(prev).add(currentRuleId));
    } else if (isKbMacroRule(current)) {
      setOpenMacroIds((prev) => new Set(prev).add(currentRuleId));
    } else {
      setOpenMicroIds((prev) => new Set(prev).add(currentRuleId));
    }
  }, [currentRuleId, rules]);

  if (visible.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 px-3 py-3 text-center text-slate-500">
        Nessuna regola estratta.
      </p>
    );
  }

  const toggleMacro = (id: string) => {
    setOpenMacroIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMicro = (id: string) => {
    setOpenMicroIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto ' + (opaqueSurface ? 'bg-slate-950' : '')
      }
    >
      {openRuleCount > 0 ? (
        <p className="shrink-0 text-xs text-amber-300/90">
          {openRuleCount} regola/e ancora da chiudere
          {onConfirmAllHigh && highOpen.length > 0 ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onConfirmAllHigh}
              className="ml-2 underline hover:text-amber-100 disabled:opacity-50"
            >
              Valida tutte high ({highOpen.length})
            </button>
          ) : null}
        </p>
      ) : null}
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5">
        {forest.map((node) => {
          const { rule, children } = node;
          const isMacro = children.length > 0 || isKbMacroRule(rule);
          if (isMacro && children.length > 0) {
            const macroOpen = openMacroIds.has(rule.id);
            const macroVisual = getKbRuleReviewVisualState(rule, currentRuleId);
            const macroFocused = rule.id === currentRuleId;
            const macroPreview = macroOpen ? null : ruleHeaderPreview(rule);
            return (
              <li
                key={rule.id}
                className={
                  'shrink-0 overflow-hidden rounded-lg border ' +
                  (macroFocused
                    ? 'border-violet-500/70 ring-1 ring-violet-500/25 ' + surfaces.macro
                    : 'border-slate-700/70 ' + surfaces.macro)
                }
              >
                <div className="flex shrink-0 items-start gap-1 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleMacro(rule.id)}
                    className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                    aria-expanded={macroOpen}
                  >
                    <RuleKindIcon rule={rule} />
                    <ReviewStateIcon state={macroVisual} />
                    {macroOpen ? (
                      <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-medium text-slate-100">{rule.title || rule.field}</span>
                        <span className="text-[10px] text-slate-500">{children.length} esempi</span>
                      </div>
                      {macroPreview ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{macroPreview}</p>
                      ) : null}
                    </div>
                  </button>
                </div>
                {macroOpen ? (
                  <div className="space-y-2 px-2 pb-2">
                    <div
                      className={
                        'rounded-md border border-slate-700/50 px-2 py-2 ' + surfaces.macroBody
                      }
                    >
                      <RuleAccordionHeader
                        rule={rule}
                        disabled={disabled}
                        onSetRuleStatus={onSetRuleStatus}
                        onPatchRule={onPatchRule}
                      />
                      <RuleBody rule={rule} disabled={disabled} onPatchRule={onPatchRule} />
                    </div>
                    <ul className="space-y-1.5">
                      {children.map((child) => (
                        <MicroRuleRow
                          key={child.id}
                          rule={child}
                          currentRuleId={currentRuleId}
                          disabled={disabled}
                          open={openMicroIds.has(child.id)}
                          microSurface={surfaces.micro}
                          onToggle={() => toggleMicro(child.id)}
                          onFocusRule={onFocusRule}
                          onSetRuleStatus={onSetRuleStatus}
                          onPatchRule={onPatchRule}
                        />
                      ))}
                    </ul>
                    <RuleFooterActions rule={rule} disabled={disabled} onFocusRule={onFocusRule} />
                  </div>
                ) : null}
              </li>
            );
          }

          const open = openMicroIds.has(rule.id);
          const visual = getKbRuleReviewVisualState(rule, currentRuleId);
          const focused = rule.id === currentRuleId;
          const preview = open ? null : ruleHeaderPreview(rule);
          return (
            <li
              key={rule.id}
              className={
                'shrink-0 rounded-lg border ' +
                (focused
                  ? 'border-violet-500/70 bg-violet-950/30 ring-1 ring-violet-500/30'
                  : 'border-slate-700/70 ' + surfaces.atomic)
              }
            >
              <button
                type="button"
                onClick={() => toggleMicro(rule.id)}
                className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left"
                aria-expanded={open}
              >
                <RuleKindIcon rule={rule} />
                <ReviewStateIcon state={visual} />
                {open ? (
                  <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                ) : (
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-100">
                    {rule.title || rule.field}
                  </span>
                  {preview ? (
                    <span className="mt-0.5 block line-clamp-1 text-xs text-slate-500">{preview}</span>
                  ) : null}
                </span>
              </button>
              {open ? (
                <div className="border-t border-slate-800/80 px-2 pb-2 pt-1 text-sm">
                  <RuleAccordionHeader
                    rule={rule}
                    disabled={disabled}
                    onSetRuleStatus={onSetRuleStatus}
                    onPatchRule={onPatchRule}
                  />
                  <RuleBody rule={rule} disabled={disabled} onPatchRule={onPatchRule} />
                  <RuleFooterActions rule={rule} disabled={disabled} onFocusRule={onFocusRule} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
