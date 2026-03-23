/**
 * Dockview default tab without close — AI Agent editor panels are mandatory and must stay open.
 * Leading Lucide icon + caption colors from aiAgentDockTabIcons; empty panels show grey tabs.
 */

import React from 'react';
import { DockviewDefaultTab, type IDockviewDefaultTabProps } from 'dockview';
import { getAiAgentDockTabPresentation } from './aiAgentDockTabIcons';
import { isAiAgentDockPanelContentFilled } from './aiAgentDockTabFillState';
import { useOptionalAIAgentEditorDock } from './AIAgentEditorDockContext';

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
    return (
      <div
        data-testid="dockview-dv-default-tab"
        {...rest}
        title={presentation.nativeTitle}
        onPointerDown={_onPointerDown}
        onPointerUp={_onPointerUp}
        onPointerLeave={_onPointerLeave}
        className="dv-default-tab"
      >
        <span className="dv-default-tab-content inline-flex items-center gap-1.5 min-w-0 max-w-full">
          {presentation.icon}
          <span className={`truncate ${presentation.titleClassName}`}>{title}</span>
        </span>
      </div>
    );
  }

  return <DockviewDefaultTab {...props} hideClose />;
}
