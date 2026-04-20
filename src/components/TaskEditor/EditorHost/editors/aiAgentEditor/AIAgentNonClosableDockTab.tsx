/**
 * Dockview default tab without close — AI Agent editor panels are mandatory and must stay open.
 * Leading Lucide icon + caption colors from aiAgentDockTabIcons; empty panels show grey tabs.
 */

import React from 'react';
import { DockviewDefaultTab, type IDockviewDefaultTabProps } from 'dockview';
import {
  AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE,
  getAgentPromptPlatformSelectOptions,
  normalizeAgentPromptPlatformId,
} from '@domain/agentPrompt';
import { getAiAgentDockTabPresentation } from './aiAgentDockTabIcons';
import { AGENT_STRUCTURED_DOCK_TAB_IDS } from './agentStructuredSectionIds';
import { isAiAgentDockPanelContentFilled } from './aiAgentDockTabFillState';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';

const PROMPT_FINALE_PANEL_ID = 'prompt_finale';

const STRUCTURED_DOCK_TAB_ID_SET = new Set<string>(AGENT_STRUCTURED_DOCK_TAB_IDS);

/** IR design sections shown as one grouped block in the tab strip (Scopo … Tono). */
function isStructuredDockSectionTab(panelId: string): boolean {
  return STRUCTURED_DOCK_TAB_ID_SET.has(panelId);
}

function usePanelTitle(api: IDockviewDefaultTabProps['api']): string {
  const [title, setTitle] = React.useState(api.title);
  React.useEffect(() => {
    const disposable = api.onDidTitleChange((event) => {
      setTitle(event.title);
    });
    return () => disposable.dispose();
  }, [api]);
  return title;
}

export function AIAgentNonClosableDockTab(props: IDockviewDefaultTabProps) {
  const {
    api,
    containerApi: _containerApi,
    params: _params,
    hideClose,
    closeActionOverride,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    tabLocation,
    ...rest
  } = props;

  const title = usePanelTitle(api);
  const dockCtx = useOptionalAIAgentEditorDock();
  const filled = dockCtx ? isAiAgentDockPanelContentFilled(api.id, dockCtx) : true;
  const presentation = getAiAgentDockTabPresentation(api.id, filled);

  const isMiddleMouseButton = React.useRef(false);
  const onClose = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (closeActionOverride) {
        closeActionOverride();
      } else {
        api.close();
      }
    },
    [api, closeActionOverride]
  );

  const onBtnPointerDown = React.useCallback((event: React.PointerEvent) => {
    event.preventDefault();
  }, []);

  const _onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isMiddleMouseButton.current = event.button === 1;
      onPointerDown?.(event);
    },
    [onPointerDown]
  );

  const _onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMiddleMouseButton.current && event.button === 1 && !hideClose) {
        isMiddleMouseButton.current = false;
        onClose(event as unknown as React.MouseEvent);
      }
      onPointerUp?.(event);
    },
    [onPointerUp, onClose, hideClose]
  );

  const _onPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isMiddleMouseButton.current = false;
      onPointerLeave?.(event);
    },
    [onPointerLeave]
  );

  if (presentation) {
    const platformInTab = api.id === PROMPT_FINALE_PANEL_ID && dockCtx;
    const structuredIr = isStructuredDockSectionTab(api.id);

    return (
      <div
        data-testid="dockview-dv-default-tab"
        {...rest}
        data-ai-agent-panel={api.id}
        {...(structuredIr ? { 'data-ai-agent-structured-section': 'true' } : {})}
        title={presentation.nativeTitle}
        onPointerDown={_onPointerDown}
        onPointerUp={_onPointerUp}
        onPointerLeave={_onPointerLeave}
        className={['dv-default-tab', presentation.tabContainerClassName].filter(Boolean).join(' ')}
      >
        <span className="dv-default-tab-content inline-flex items-center gap-1 min-w-0 max-w-full">
          {presentation.icon}
          {platformInTab ? (
            <>
              <span className={`shrink-0 whitespace-nowrap text-[11px] leading-none ${presentation.titleClassName}`}>
                Prompt per
              </span>
              <select
                value={normalizeAgentPromptPlatformId(dockCtx.agentPromptTargetPlatform)}
                title={presentation.nativeTitle}
                aria-label="Piattaforma destinazione prompt"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === AGENT_PROMPT_PLATFORM_SELECT_SEPARATOR_VALUE) return;
                  dockCtx.setAgentPromptTargetPlatform(normalizeAgentPromptPlatformId(v));
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="ai-agent-prompt-platform-select shrink-0 rounded border border-emerald-600/50 bg-slate-900/95 px-1.5 py-0.5 text-[10px] leading-tight text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/40"
              >
                {getAgentPromptPlatformSelectOptions().map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Mostra payload JSON runtime (solo lettura) al posto dell’anteprima testuale"
                aria-pressed={dockCtx.promptFinaleJsMode}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dockCtx.setPromptFinaleJsMode(!dockCtx.promptFinaleJsMode);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border transition-colors ${
                  dockCtx.promptFinaleJsMode
                    ? 'border-emerald-500/70 bg-emerald-950/60 text-emerald-100'
                    : 'border-slate-600 bg-slate-900/90 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                JS
              </button>
            </>
          ) : (
            <span className={`whitespace-nowrap ${presentation.titleClassName}`}>{title}</span>
          )}
        </span>
      </div>
    );
  }

  return <DockviewDefaultTab {...props} hideClose />;
}
