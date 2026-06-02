/**
 * Toolbar Backend Call embedded (tab Backends AI Agent).
 * Riga unica: Signature (+ 3 azioni firma) · Test backend · Emulate backend.
 * Signature attivo abilita Check Update / nomi sorgente / RECEIVE; altrimenti grigio.
 */

import React from 'react';
import {
  BookOpen,
  Columns2,
  Eye,
  EyeOff,
  FlaskConical,
  Loader2,
  Play,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import type { ToolbarButton } from '../../../../../dock/types';

const ICON = 14;
const ICON_STROKE = 2;
const ROW_H = 'min-h-[2rem] h-8';

const BTN =
  `inline-flex ${ROW_H} shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors`;
const BTN_NEUTRAL =
  'border-slate-600/45 bg-slate-900/50 text-slate-200 hover:border-slate-500/50 hover:bg-slate-800/80 hover:text-slate-50';
const BTN_ACTIVE_SKY =
  'border-sky-400 bg-sky-600/90 text-white shadow-md shadow-sky-950/45';
const BTN_ACTIVE_EMERALD =
  'border-emerald-400 bg-emerald-600/85 text-white shadow-md shadow-emerald-950/40';

const SIG_CLUSTER =
  'inline-flex max-w-full min-w-0 flex-nowrap items-stretch overflow-hidden rounded-md border border-slate-600/50 bg-slate-950/60';
const SIG_LEAD_ACTIVE = 'bg-violet-600/90 text-white shadow-inner shadow-violet-950/50';
const SIG_LEAD_IDLE = `${BTN_NEUTRAL} rounded-none rounded-l-md border-0 border-r border-slate-600/45`;
const SIG_SUB_BASE = `inline-flex ${ROW_H} shrink-0 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium transition-colors border-0 outline-none`;
const SIG_SUB_ENABLED = 'text-slate-200 hover:bg-white/[0.08] hover:text-white';
const SIG_SUB_DISABLED = 'cursor-not-allowed text-slate-600 opacity-45 pointer-events-none';
const SIG_SUB_ACTIVE = 'bg-sky-500/30 text-sky-50 ring-1 ring-inset ring-sky-400/55';

function findBtn(buttons: ToolbarButton[], id: string): ToolbarButton | undefined {
  return buttons.find((b) => b.buttonId === id);
}

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

function TestBackendSplitButton({ btn }: { btn: ToolbarButton }) {
  const sub = btn.subAction;
  const gw = btn.gatewaySubAction;
  const tableOpen = Boolean(btn.active);
  const busyDots = useBusyDots(Boolean(sub?.busy || gw?.busy));

  if ((!sub && !gw) || !tableOpen) {
    return (
      <ToolbarIconButton
        activeTone="emerald"
        icon={
          btn.icon ?? (
            <FlaskConical size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
          )
        }
        label={btn.label ?? 'Test backend'}
        active={tableOpen}
        onClick={btn.onClick}
        disabled={btn.disabled}
        title={btn.title}
      />
    );
  }

  const shellActive = Boolean(btn.active || btn.successHighlight);
  const shellBorder = shellActive ? 'border-emerald-400' : 'border-slate-600/45';
  const dividerCls = shellActive ? 'bg-emerald-500/40' : 'bg-slate-600/50';
  const subBtnCls = (disabled?: boolean) =>
    `inline-flex h-full max-w-[11rem] items-center justify-center gap-1 border-0 bg-transparent px-2 text-[10px] font-semibold transition-colors hover:bg-emerald-500/20 ${
      shellActive ? 'text-emerald-50' : 'text-emerald-300/90 hover:text-emerald-100'
    } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`;

  const renderSubButton = (
    action: NonNullable<ToolbarButton['subAction']>,
    key: string
  ) => (
    <button
      key={key}
      type="button"
      title={action.title}
      aria-busy={action.busy}
      aria-disabled={action.disabled}
      onClick={() => void action.onClick?.()}
      className={subBtnCls(action.disabled)}
    >
      {action.busy ? (
        <Loader2 size={12} strokeWidth={2.5} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        <Play size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">
        {action.busy
          ? `${action.busyLabel ?? 'Sto testando il backend'}${busyDots}`
          : action.label}
      </span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Test backend"
      className={`inline-flex ${ROW_H} shrink-0 overflow-hidden rounded-md border ${shellBorder} ${
        shellActive ? 'bg-emerald-600/85 shadow-md shadow-emerald-950/40' : 'bg-slate-900/50'
      }`}
    >
      <button
        type="button"
        title={btn.title}
        disabled={btn.disabled}
        onClick={btn.onClick}
        aria-pressed={btn.active}
        className={`inline-flex h-full items-center justify-center gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium transition-colors hover:bg-white/[0.06] ${
          shellActive ? 'text-white' : 'text-slate-200 hover:text-slate-50'
        } disabled:pointer-events-none disabled:opacity-45`}
      >
        {btn.icon ?? (
          <FlaskConical
            size={ICON}
            strokeWidth={ICON_STROKE}
            className={`shrink-0 ${shellActive ? 'text-emerald-100' : 'text-slate-400'}`}
            aria-hidden
          />
        )}
        <span className="whitespace-nowrap">{btn.label ?? 'Test backend'}</span>
      </button>
      {sub ? (
        <>
          <div className={`w-px shrink-0 self-stretch ${dividerCls}`} aria-hidden />
          {renderSubButton(sub, 'execute')}
        </>
      ) : null}
      {gw ? (
        <>
          <div className={`w-px shrink-0 self-stretch ${dividerCls}`} aria-hidden />
          {renderSubButton(gw, 'gateway')}
        </>
      ) : null}
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
  const activeCls = activeTone === 'emerald' ? BTN_ACTIVE_EMERALD : BTN_ACTIVE_SKY;
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`${BTN} ${active ? activeCls : BTN_NEUTRAL} disabled:pointer-events-none disabled:opacity-45`}
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
  const signatureActive = controlled ? signatureSubOpenProp : signatureSubInternal;
  const setSignatureActive = React.useCallback(
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
  const isEmulateTableOpen = showTableBtn?.active ?? false;
  const isTestTableOpen = testBackendBtn?.active ?? false;

  const handleSignatureClick = () => {
    const next = !signatureActive;
    if (next && (isEmulateTableOpen || isTestTableOpen)) {
      if (isEmulateTableOpen) showTableBtn?.onClick?.();
      else if (isTestTableOpen) testBackendBtn?.onClick?.();
    }
    setSignatureActive(next);
  };

  const ensureEmulationMode = () => {
    if (!isEmulation) emulationBtn?.onClick?.();
  };

  const ensureRealMode = () => {
    if (isEmulation) realBtn?.onClick?.();
  };

  const handleEmulateBackend = () => {
    setSignatureActive(false);
    if (isEmulation) {
      if (isEmulateTableOpen) showTableBtn?.onClick?.();
      else showTableBtn?.onClick?.();
      return;
    }
    ensureEmulationMode();
    if (!isEmulateTableOpen) showTableBtn?.onClick?.();
  };

  const handleTestBackend = () => {
    setSignatureActive(false);
    if (!isEmulation) {
      testBackendBtn?.onClick?.();
      return;
    }
    ensureRealMode();
    if (!isTestTableOpen) testBackendBtn?.onClick?.();
  };

  if (buttons.length === 0) return null;

  const showReadApi = readApiBtn && readApiBtn.visible !== false;
  const showNameToggle = Boolean(showApiColBtn);
  const showHideReceive = hideReceiveBtn && hideReceiveBtn.visible !== false;
  const sigSubEnabled = signatureActive;

  const sigSubCls = (pressed?: boolean) =>
    `${SIG_SUB_BASE} ${sigSubEnabled ? SIG_SUB_ENABLED : SIG_SUB_DISABLED} ${
      sigSubEnabled && pressed ? SIG_SUB_ACTIVE : ''
    }`;

  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-md border border-slate-700/50 bg-slate-900/70 px-2 py-1.5">
      <div role="group" aria-label="Signature tools" className={SIG_CLUSTER}>
        <button
          type="button"
          title="Segna sulla firma SEND/RECEIVE: abilita Check Update e opzioni mapping"
          aria-pressed={signatureActive}
          onClick={handleSignatureClick}
          className={`${BTN} shrink-0 rounded-none rounded-l-md border-0 border-r border-slate-600/45 px-2.5 ${
            signatureActive ? SIG_LEAD_ACTIVE : SIG_LEAD_IDLE
          }`}
        >
          <SlidersHorizontal size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
          <span className="whitespace-nowrap">Signature</span>
        </button>

        {showReadApi ? (
          <button
            type="button"
            title={readApiBtn?.title ?? 'Verify parameter updates from the API'}
            disabled={!sigSubEnabled || readApiBtn?.disabled}
            onClick={readApiBtn?.onClick}
            className={sigSubCls()}
          >
            {readApiBtn?.disabled ? (
              <Loader2 size={ICON} strokeWidth={ICON_STROKE} className="shrink-0 animate-spin" aria-hidden />
            ) : (
              <BookOpen size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
            )}
            <span className="whitespace-nowrap">
              {readApiBtn?.disabled ? 'Checking…' : 'Check Update'}
            </span>
          </button>
        ) : null}

        {showNameToggle && showApiColBtn ? (
          <button
            type="button"
            aria-pressed={showApiColBtn.active}
            disabled={!sigSubEnabled}
            title={
              showApiColBtn.title ?? 'Show or hide backend source parameter names in the mapping tree'
            }
            onClick={showApiColBtn.onClick}
            className={sigSubCls(showApiColBtn.active)}
          >
            {showApiColBtn.active ? (
              <EyeOff size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
            ) : (
              <Eye size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
            )}
            <span className="whitespace-nowrap">
              {showApiColBtn.label ??
                (showApiColBtn.active ? 'Hide source names' : 'Show source names')}
            </span>
          </button>
        ) : null}

        {showHideReceive && hideReceiveBtn ? (
          <button
            type="button"
            aria-pressed={hideReceiveBtn.active}
            disabled={!sigSubEnabled}
            title={hideReceiveBtn.title}
            onClick={hideReceiveBtn.onClick}
            className={sigSubCls(hideReceiveBtn.active)}
          >
            <Columns2 size={ICON} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{hideReceiveBtn.label}</span>
          </button>
        ) : null}
      </div>

      {testBackendBtn && testBackendBtn.visible !== false ? (
        <TestBackendSplitButton
          btn={{
            ...testBackendBtn,
            onClick: handleTestBackend,
          }}
        />
      ) : null}

      {showTableBtn && showTableBtn.visible !== false ? (
        <ToolbarIconButton
          activeTone="sky"
          icon={<Table2 size={ICON} strokeWidth={ICON_STROKE} aria-hidden />}
          label="Emulate backend"
          active={isEmulation && isEmulateTableOpen}
          onClick={handleEmulateBackend}
          title={
            showTableBtn.title ??
            'Emula il backend con valori di test (tabella mock). Chiudi Signature per aprire la tabella.'
          }
        />
      ) : null}
    </div>
  );
}
