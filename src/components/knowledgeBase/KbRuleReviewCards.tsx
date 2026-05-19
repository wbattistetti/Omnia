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
import { ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { KbPanelExpandButton } from './KbPanelExpandButton';
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
  onRuleMaximizedChange?: (ruleId: string | null) => void;
};

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
  const macro = isKbMacroRule(rule);
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5">
      <label
        className="inline-flex items-center gap-1 text-[10px] text-slate-400"
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
      <span className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400">{rule.confidence}</span>
      {macro ? (
        <span className="rounded bg-violet-950/60 px-1 py-0.5 text-[10px] text-violet-200">macro</span>
      ) : rule.ruleKind === 'micro' ? (
        <span className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400">esempio</span>
      ) : null}
      {confidenceBlocksPromotion(rule.confidence) && rule.status === 'hypothesized' ? (
        <span className="text-[10px] text-amber-400" title="Richiede validazione esplicita">
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
  return (
    <>
      <label className="mt-1 block text-[10px] text-slate-500">Regola</label>
      <textarea
        rows={2}
        disabled={disabled}
        value={rule.rule}
        onChange={(e) => onPatchRule(rule.id, { rule: e.target.value })}
        className={fieldClass}
      />
      {rule.evidence ? <p className="mt-1 text-xs text-slate-500">«{rule.evidence}»</p> : null}
      <label className="mt-2 block text-[10px] text-slate-500">Trigger</label>
      <input
        type="text"
        disabled={disabled}
        value={rule.trigger}
        onChange={(e) => onPatchRule(rule.id, { trigger: e.target.value })}
        className={fieldClass}
      />
      <label className="mt-1 block text-[10px] text-slate-500">Azione</label>
      <input
        type="text"
        disabled={disabled}
        value={rule.action}
        onChange={(e) => onPatchRule(rule.id, { action: e.target.value })}
        className={fieldClass}
      />
    </>
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
  microBg: string;
  onToggle: () => void;
  onFocusRule: (id: string) => void;
  onSetRuleStatus: (id: string, status: KbRuleStatus) => void;
  onPatchRule: (id: string, patch: Partial<KbInducedRule>) => void;
};

function MicroRuleRow({
  rule,
  currentRuleId,
  disabled,
  open,
  microBg,
  onToggle,
  onFocusRule,
  onSetRuleStatus,
  onPatchRule,
}: MicroRuleRowProps): React.ReactElement {
  const visual = getKbRuleReviewVisualState(rule, currentRuleId);
  const focused = rule.id === currentRuleId;
  return (
    <li
      className={
        'rounded border text-sm ' +
        (focused
          ? 'border-violet-500/70 bg-violet-950/25 ring-1 ring-violet-500/30'
          : 'border-slate-800/80 ' + microBg)
      }
    >
      <div className="flex items-start gap-0.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
          aria-expanded={open}
        >
          <ReviewStateIcon state={visual} />
          {open ? (
            <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
            {rule.title || rule.field}
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
  onRuleMaximizedChange,
}: KbRuleReviewCardsProps): React.ReactElement {
  const cardBg = opaqueSurface ? 'bg-slate-900' : 'bg-slate-900/50';
  const microBg = opaqueSurface ? 'bg-slate-950' : 'bg-slate-950/40';
  const forest = React.useMemo(() => buildKbRuleForest(rules), [rules]);
  const [openMacroIds, setOpenMacroIds] = React.useState<Set<string>>(() => new Set());
  const [openMicroIds, setOpenMicroIds] = React.useState<Set<string>>(() => new Set());
  const [maximizedRuleId, setMaximizedRuleId] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    setMaximizedRuleId(null);
    onRuleMaximizedChange?.(null);
  }, [rules, onRuleMaximizedChange]);

  React.useEffect(() => {
    if (maximizedRuleId && !forest.some((n) => n.rule.id === maximizedRuleId)) {
      setMaximizedRuleId(null);
      onRuleMaximizedChange?.(null);
    }
  }, [forest, maximizedRuleId, onRuleMaximizedChange]);

  const toggleMaximize = React.useCallback(
    (ruleId: string, children: readonly KbInducedRule[] = []) => {
      setMaximizedRuleId((prev) => {
        const next = prev === ruleId ? null : ruleId;
        onRuleMaximizedChange?.(next);
        if (next) {
          setOpenMacroIds((s) => new Set(s).add(ruleId));
          setOpenMicroIds((s) => {
            const n = new Set(s);
            if (children.length > 0) {
              for (const c of children) n.add(c.id);
            } else {
              n.add(ruleId);
            }
            return n;
          });
        }
        return next;
      });
    },
    [onRuleMaximizedChange]
  );

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

  const nodesToShow = maximizedRuleId
    ? forest.filter((n) => n.rule.id === maximizedRuleId)
    : forest;

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col gap-2 ' +
        (maximizedRuleId ? 'overflow-hidden ' : 'overflow-y-auto ') +
        (opaqueSurface ? 'bg-slate-950' : '')
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
      <ul
        className={
          'flex min-h-0 flex-1 flex-col gap-1.5 ' + (maximizedRuleId ? 'overflow-hidden' : '')
        }
      >
        {nodesToShow.map((node) => {
          const { rule, children } = node;
          const isMacro = children.length > 0 || isKbMacroRule(rule);
          if (isMacro && children.length > 0) {
            const isMaximized = maximizedRuleId === rule.id;
            const macroOpen = isMaximized || openMacroIds.has(rule.id);
            const macroVisual = getKbRuleReviewVisualState(rule, currentRuleId);
            const macroFocused = rule.id === currentRuleId;
            return (
              <li
                key={rule.id}
                className={
                  (isMaximized ? 'flex min-h-0 flex-1 flex-col ' : 'shrink-0 ') +
                  'rounded-md border ' +
                  (macroFocused
                    ? 'border-violet-500/80 bg-violet-950/20'
                    : 'border-slate-800 ' + cardBg)
                }
              >
                <div className="flex shrink-0 items-start gap-1 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleMacro(rule.id)}
                    className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                    aria-expanded={macroOpen}
                  >
                    <ReviewStateIcon state={macroVisual} />
                    {macroOpen ? (
                      <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    ) : (
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-medium text-slate-100">{rule.title || rule.field}</span>
                        <span className="rounded bg-violet-950/60 px-1 py-0.5 text-[10px] text-violet-200">
                          macro · {children.length} esempi
                        </span>
                      </div>
                      <p
                        className={
                          'mt-0.5 text-xs text-slate-400 ' + (isMaximized ? '' : 'line-clamp-2')
                        }
                      >
                        {rule.rule}
                      </p>
                    </div>
                  </button>
                  <KbPanelExpandButton
                    expanded={isMaximized}
                    onToggle={() => toggleMaximize(rule.id, children)}
                    expandTitle="Espandi regola a tutto il pannello"
                    collapseTitle="Riduci elenco regole"
                    expandAriaLabel="Espandi regola"
                    collapseAriaLabel="Riduci regola"
                  />
                </div>
                {macroOpen ? (
                  <div
                    className={
                      (isMaximized
                        ? 'flex min-h-0 flex-1 flex-col overflow-y-auto '
                        : '') + 'space-y-1.5 border-t border-slate-800/80 px-2 pb-2 pt-1'
                    }
                  >
                    <RuleAccordionHeader
                      rule={rule}
                      disabled={disabled}
                      onSetRuleStatus={onSetRuleStatus}
                      onPatchRule={onPatchRule}
                    />
                    <RuleBody rule={rule} disabled={disabled} onPatchRule={onPatchRule} />
                    <ul className="space-y-1 pl-1">
                      {children.map((child) => (
                        <MicroRuleRow
                          key={child.id}
                          rule={child}
                          currentRuleId={currentRuleId}
                          disabled={disabled}
                          open={openMicroIds.has(child.id)}
                          microBg={microBg}
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
          return (
            <li
              key={rule.id}
              className={
                'shrink-0 rounded-md border ' +
                (focused
                  ? 'border-violet-500/80 bg-violet-950/30 ring-1 ring-violet-500/40'
                  : 'border-slate-800 ' + cardBg)
              }
            >
              <button
                type="button"
                onClick={() => toggleMicro(rule.id)}
                className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left"
                aria-expanded={open}
              >
                <ReviewStateIcon state={visual} />
                {open ? (
                  <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                ) : (
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                  {rule.title || rule.field}
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
