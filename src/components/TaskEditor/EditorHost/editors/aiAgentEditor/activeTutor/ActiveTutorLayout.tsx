/**

 * Active Tutor — layout wizard + pannello tutor a destra (split fisso).

 */



import React from 'react';

import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';

import { ActiveTutorPanel } from './ActiveTutorPanel';



const DEFAULT_TUTOR_WIDTH_PX = 320;

const MIN_TUTOR_WIDTH_PX = 260;

const MAX_TUTOR_WIDTH_PX = 480;



export interface ActiveTutorLayoutProps {

  readonly taskId: string;

  readonly taskLabel?: string;

  readonly generating: boolean;

  readonly phaseCompletion: readonly boolean[];

  readonly onSelectWizardStep: (index: AgentWizardStepIndex) => void;
  readonly onAcknowledgeWelcome?: () => void;
  readonly children: React.ReactNode;
}



export function ActiveTutorLayout({

  taskId,

  taskLabel,

  generating,

  phaseCompletion,

  onSelectWizardStep,

  onAcknowledgeWelcome,

  children,

}: ActiveTutorLayoutProps): React.ReactElement {

  const [tutorWidthPx, setTutorWidthPx] = React.useState(DEFAULT_TUTOR_WIDTH_PX);

  const draggingRef = React.useRef(false);



  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {

    e.preventDefault();

    draggingRef.current = true;

    e.currentTarget.setPointerCapture(e.pointerId);

  };



  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {

    if (!draggingRef.current) return;

    const container = e.currentTarget.parentElement;

    if (!container) return;

    const rect = container.getBoundingClientRect();

    const next = Math.round(rect.right - e.clientX);

    setTutorWidthPx(Math.min(MAX_TUTOR_WIDTH_PX, Math.max(MIN_TUTOR_WIDTH_PX, next)));

  };



  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {

    draggingRef.current = false;

    e.currentTarget.releasePointerCapture(e.pointerId);

  };



  return (

    <div className="flex h-full min-h-0 w-full overflow-hidden">

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>

      <div

        role="separator"

        aria-orientation="vertical"

        aria-label="Ridimensiona pannello tutor"

        className="w-1 shrink-0 cursor-col-resize bg-slate-700/50 hover:bg-violet-500/40"

        onPointerDown={onResizePointerDown}

        onPointerMove={onResizePointerMove}

        onPointerUp={onResizePointerUp}

      />

      <div

        className="h-full shrink-0 overflow-hidden"

        style={{ width: tutorWidthPx }}

      >

        <ActiveTutorPanel

          taskId={taskId}

          taskLabel={taskLabel}

          generating={generating}

          phaseCompletion={phaseCompletion}

          onSelectWizardStep={onSelectWizardStep}

          onAcknowledgeWelcome={onAcknowledgeWelcome}

        />

      </div>

    </div>

  );

}

