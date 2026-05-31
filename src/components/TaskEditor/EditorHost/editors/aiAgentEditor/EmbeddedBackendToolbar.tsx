/**
 * Toolbar per BackendCallEditor in modalità embedded (tab Backends / AI Agent).
 *
 * - Toggle principale: Emulation ↔ Real backend call (non chiude Signature: il pannello resta stabile).
 * - Signature: sempre visibile; se attivo, il gruppo azioni è unito visivamente a destra (bordo + fondo tenue).
 * - In Emulation: Emulation table; in Real: Test Backend (apre tabella) + sottopulsante Esegui.
 * I pulsanti azione provengono da `BackendCallEditor` tramite `buttonId`.
 */

import React from 'react';
import {
  BookOpen,
  Columns2,
  Database,
  Eye,
  EyeOff,
  FlaskConical,
  Play,
  Loader2,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import type { ToolbarButton } from '../../../../../dock/types';

const ICON = 14;
const ICON_STROKE = 2;
const ROW_H = 'min-h-[2rem] h-8';

/** Pulsanti principali (fuori dal cluster Signature). */
const BTN =
  `inline-flex ${ROW_H} shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors`;
const BTN_NEUTRAL =
  'border-slate-600/45 bg-slate-900/50 text-slate-200 hover:border-slate-500/50 hover:bg-slate-800/80 hover:text-slate-50';
const BTN_ACTIVE_SKY =
  'border-sky-600/55 bg-sky-950/55 text-sky-100 shadow-inner shadow-sky-950/40';
const BTN_ACTIVE_EMERALD =
  'border-emerald-700/50 bg-emerald-950/55 text-emerald-50 shadow-inner shadow-emerald-950/35';

/** Controlli nel pannello Signature: stesso stile ghost di «Check Update» (sfondo trasparente, hover leggero). */
const SIG_GHOST =
  `inline-flex ${ROW_H} shrink-0 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium transition-colors border-0 bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-slate-400/35`;
const SIG_GHOST_HOVER = 'text-slate-200 hover:bg-white/[0.06] hover:text-slate-50';

function findBtn(buttons: ToolbarButton[], id: string): ToolbarButton | undefined {
  return buttons.find((b) => b.buttonId === id);
}

/** Puntini animati durante bulk test (… . .. …). */
function useBusyDots(active: boolean): string {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    const t = window.setInterval(() => setPhase((p) => (p + 1) % 4), 420);
    return () => window.clearInterval(t);
  }, [active]);
  if (!active) return '';
  return '.'.repeat(phase);
}

/** Test Backend: area principale apre tabella; sottopulsante «Esegui» lancia HTTP. */
function TestBackendSplitButton({
  btn,
  activeTone = 'emerald',
}: {
  btn: ToolbarButton;
  activeTone?: 'sky' | 'emerald';
}) {
  const sub = btn.subAction;
  const tableOpen = Boolean(btn.active);
  const busyDots = useBusyDots(Boolean(sub?.busy));

  if (!sub || !tableOpen) {
    return (
      <ToolbarIconButton
        activeTone={activeTone}
        icon={
          btn.icon ?? (
            <FlaskConical size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
          )
        }
        label={btn.label ?? 'Test Backend'}
        active={tableOpen}
        onClick={btn.onClick}
        disabled={btn.disabled}
        title={btn.title}
      />
    );
  }

  const shellActive = Boolean(btn.active || btn.successHighlight);
  const shellBorder = shellActive
    ? activeTone === 'emerald'
      ? 'border-emerald-700/50'
      : 'border-sky-600/55'
    : 'border-slate-600/45';

  return (
    <div
      role="group"
      aria-label="Test Backend"
      className={`inline-flex ${ROW_H} shrink-0 overflow-hidden rounded-md border ${shellBorder} ${
        shellActive
          ? activeTone === 'emerald'
            ? 'bg-emerald-950/55 shadow-inner shadow-emerald-950/35'
            : 'bg-sky-950/55 shadow-inner shadow-sky-950/40'
          : 'bg-slate-900/50'
      }`}
    >
      <button
        type="button"
        title={btn.title}
        disabled={btn.disabled}
        onClick={btn.onClick}
        aria-pressed={btn.active}
        className={`inline-flex h-full items-center justify-center gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium transition-colors hover:bg-white/[0.06] ${
          shellActive
            ? activeTone === 'emerald'
              ? 'text-emerald-50'
              : 'text-sky-100'
            : 'text-slate-200 hover:text-slate-50'
        } disabled:pointer-events-none disabled:opacity-45`}
      >
        {btn.icon ?? (
          <FlaskConical
            size={ICON}
            strokeWidth={ICON_STROKE}
            className={`shrink-0 ${shellActive ? 'text-emerald-200' : 'text-slate-400'}`}
            aria-hidden
          />
        )}
        <span className="whitespace-nowrap">{btn.label ?? 'Test Backend'}</span>
      </button>
      <div
        className={`w-px shrink-0 self-stretch ${
          shellActive ? 'bg-emerald-600/35' : 'bg-slate-600/50'
        }`}
        aria-hidden
      />
      <button
        type="button"
        title={sub.title}
        disabled={sub.disabled}
        onClick={sub.onClick}
        aria-busy={sub.busy}
        className={`inline-flex h-full max-w-[11rem] items-center justify-center gap-1 border-0 bg-transparent px-2 text-[10px] font-semibold transition-colors hover:bg-emerald-500/15 ${
          shellActive ? 'text-emerald-100' : 'text-emerald-300/90 hover:text-emerald-100'
        } disabled:pointer-events-none disabled:opacity-45`}
      >
        {sub.busy ? (
          <Loader2 size={12} strokeWidth={2.5} className="shrink-0 animate-spin" aria-hidden />
        ) : (
          <Play size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {sub.busy ? `${sub.busyLabel ?? 'Sto testando il backend'}${busyDots}` : sub.label}
        </span>
      </button>
    </div>
  );
}

function ToolbarIconButton({
  icon,
  label,
  active,
  onClick,
  title,
  disabled,
  activeTone = 'sky',
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  activeTone?: 'sky' | 'emerald';
}) {
  const activeCls =
    activeTone === 'emerald' ? BTN_ACTIVE_EMERALD : BTN_ACTIVE_SKY;
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`${BTN} ${
        active ? activeCls : BTN_NEUTRAL
      } disabled:pointer-events-none disabled:opacity-45`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function EmbeddedBackendToolbar({
  buttons,
  signatureSubOpen: signatureSubOpenProp,
  onSignatureSubOpenChange,
}: {
  buttons: ToolbarButton[];
  signatureSubOpen?: boolean;
  onSignatureSubOpenChange?: (open: boolean) => void;
}) {
  const [signatureSubInternal, setSignatureSubInternal] = React.useState(false);
  const controlled =
    typeof signatureSubOpenProp === 'boolean' && typeof onSignatureSubOpenChange === 'function';
  const showSignatureSub = controlled ? signatureSubOpenProp : signatureSubInternal;
  const setShowSignatureSub = React.useCallback(
    (next: boolean) => {
      if (controlled && onSignatureSubOpenChange) onSignatureSubOpenChange(next);
      else setSignatureSubInternal(next);
    },
    [controlled, onSignatureSubOpenChange]
  );

  const emulationBtn = findBtn(buttons, 'mode-emulation');
  const realBtn = findBtn(buttons, 'mode-real');
  const showTableBtn = findBtn(buttons, 'show-table');
  const showApiColBtn = findBtn(buttons, 'show-api-column');
  const readApiBtn = findBtn(buttons, 'read-api');
  const testBackendBtn = findBtn(buttons, 'test-backend');
  const hideReceiveBtn = findBtn(buttons, 'hide-receive');

  const isEmulation = emulationBtn?.active ?? true;
  const isTableShown = showTableBtn?.active ?? false;

  const shellClass = isEmulation
    ? 'border-sky-700/35 bg-sky-950/40'
    : 'border-emerald-900/40 bg-slate-900/70';

  /** Cluster Signature+azioni: bordo visibile, fondo molto desaturato (no pattern). */
  const signatureClusterShell = isEmulation
    ? 'border-sky-500/35 bg-sky-950/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
    : 'border-emerald-700/30 bg-emerald-950/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

  const sigActiveTone = isEmulation ? 'sky' : 'emerald';

  const handleModeToggle = () => {
    if (isEmulation) realBtn?.onClick?.();
    else emulationBtn?.onClick?.();
  };

  const handleSignatureClick = () => {
    if (isTableShown) showTableBtn?.onClick?.();
    setShowSignatureSub(!showSignatureSub);
  };

  const handleTableClick = () => {
    if (!isTableShown) setShowSignatureSub(false);
    showTableBtn?.onClick?.();
  };

  if (buttons.length === 0) return null;

  const showReadApi = readApiBtn && readApiBtn.visible !== false;
  const showNameToggle = Boolean(showApiColBtn);
  const showHideReceive = hideReceiveBtn && hideReceiveBtn.visible !== false;
  const signatureGroupHasContent = showReadApi || showNameToggle || showHideReceive;

  const signatureActiveCls =
    sigActiveTone === 'emerald' ? BTN_ACTIVE_EMERALD : BTN_ACTIVE_SKY;

  /** Stato attivo Signature dentro il cluster: stesso riempimento del BTN attivo, senza bordo esterno (il bordo è del gruppo). */
  const signatureMergedLeadFill =
    sigActiveTone === 'emerald'
      ? 'bg-emerald-950/60 text-emerald-50 shadow-inner shadow-emerald-950/35'
      : 'bg-sky-950/60 text-sky-50 shadow-inner shadow-sky-950/30';

  const signatureButtonEl = (opts: { inCluster: boolean }) => (
    <button
      type="button"
      title="Open signature tools: check API updates and show or hide backend source names"
      aria-pressed={showSignatureSub}
      onClick={handleSignatureClick}
      className={
        opts.inCluster
          ? `${BTN} shrink-0 rounded-none rounded-l-md border-0 border-r border-slate-500/30 px-2.5 ${signatureMergedLeadFill}`
          : `${BTN} ${showSignatureSub ? signatureActiveCls : BTN_NEUTRAL}`
      }
    >
      <SlidersHorizontal size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
      <span className="whitespace-nowrap">Signature</span>
    </button>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 ${shellClass}`}>
      <button
        type="button"
        onClick={handleModeToggle}
        title={isEmulation ? 'Simulate backend with test values' : 'Execute a real backend call'}
        aria-pressed={isEmulation}
        className={`${BTN} ${isEmulation ? BTN_ACTIVE_SKY : BTN_ACTIVE_EMERALD}`}
      >
        {isEmulation ? (
          <>
            <Table2 size={ICON} strokeWidth={ICON_STROKE} className="shrink-0 text-sky-200" aria-hidden />
            <span>Emulation mode</span>
          </>
        ) : (
          <>
            <Database size={ICON} strokeWidth={ICON_STROKE} className="shrink-0 text-emerald-200" aria-hidden />
            <span>Real backend call</span>
          </>
        )}
      </button>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {showSignatureSub && signatureGroupHasContent ? (
          <div
            role="group"
            aria-label="Signature tools"
            className={`inline-flex max-w-full min-w-0 flex-wrap items-stretch overflow-hidden rounded-md border transition-[opacity,background-color,border-color] duration-150 ease-out ${signatureClusterShell}`}
          >
            {signatureButtonEl({ inCluster: true })}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 px-1 py-0.5 sm:gap-1">
              {showReadApi ? (
                <button
                  type="button"
                  title={readApiBtn?.title ?? 'Verify parameter updates from the API'}
                  disabled={readApiBtn?.disabled}
                  onClick={readApiBtn?.onClick}
                  className={`${SIG_GHOST} ${SIG_GHOST_HOVER} disabled:pointer-events-none disabled:opacity-45`}
                >
                  {readApiBtn?.disabled ? (
                    <Loader2 size={ICON} strokeWidth={ICON_STROKE} className="shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <BookOpen size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
                  )}
                  <span className="whitespace-nowrap">{readApiBtn?.disabled ? 'Checking…' : 'Check Update'}</span>
                </button>
              ) : null}

              {showNameToggle && showApiColBtn ? (
                <button
                  type="button"
                  aria-pressed={showApiColBtn.active}
                  title={
                    showApiColBtn.title ??
                    'Show or hide backend source names in the mapping tree'
                  }
                  onClick={showApiColBtn.onClick}
                  className={`${SIG_GHOST} ${SIG_GHOST_HOVER}`}
                >
                  {showApiColBtn.active ? (
                    <EyeOff size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
                  ) : (
                    <Eye size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
                  )}
                  <span className="whitespace-nowrap">
                    {showApiColBtn.label ?? (showApiColBtn.active ? 'Hide source names' : 'Show source names')}
                  </span>
                </button>
              ) : null}

              {showHideReceive && hideReceiveBtn ? (
                <button
                  type="button"
                  aria-pressed={hideReceiveBtn.active}
                  title={hideReceiveBtn.title}
                  onClick={hideReceiveBtn.onClick}
                  className={`${SIG_GHOST} ${SIG_GHOST_HOVER}`}
                >
                  <Columns2 size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{hideReceiveBtn.label}</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          signatureButtonEl({ inCluster: false })
        )}
      </div>

      {isEmulation ? (
        <ToolbarIconButton
          activeTone="sky"
          icon={<Table2 size={ICON} strokeWidth={ICON_STROKE} aria-hidden />}
          label={showTableBtn?.label ?? 'Emulation table'}
          active={isTableShown}
          onClick={handleTableClick}
          title={
            showTableBtn?.title ??
            'Emulation table: mock values and tests. Use Signature to return to API check and mapping tools.'
          }
        />
      ) : testBackendBtn && testBackendBtn.visible !== false ? (
        <TestBackendSplitButton btn={testBackendBtn} activeTone="emerald" />
      ) : null}
    </div>
  );
}
