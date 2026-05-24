/**

 * Active Tutor — tab interne del pannello (7 fasi wizard).

 */



import React from 'react';

import type { TutorPhaseId } from '@domain/activeTutor/tutorPhase';

import { TUTOR_PHASE_LABELS, TUTOR_PHASE_ORDER } from '@domain/activeTutor/tutorPhase';

import { tutorPhaseKeyFromId } from '@domain/activeTutor/tutorPhaseKey';



export interface TutorTabsProps {

  readonly activePhase: TutorPhaseId;

  readonly phaseCompletion: readonly boolean[];

  readonly onSelectPhase: (phase: TutorPhaseId) => void;

}



const TAB_STYLES: Readonly<

  Record<

    ReturnType<typeof tutorPhaseKeyFromId>,

    { active: string; idle: string; dot: string; activeDot: string; glowClass: string }

  >

> = {

  task: {

    active:

      'border-violet-300 bg-violet-900/90 text-violet-50 shadow-[0_0_14px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-violet-300/70',

    idle: 'border-violet-500/20 bg-slate-900/40 text-violet-300/50 opacity-60 hover:opacity-90 hover:bg-violet-950/30 hover:border-violet-500/40',

    dot: 'bg-violet-400/70',

    activeDot: 'bg-violet-200 shadow-[0_0_6px_rgba(196,181,253,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-task',

  },

  knowledgeBase: {

    active:

      'border-fuchsia-300 bg-fuchsia-900/85 text-fuchsia-50 shadow-[0_0_14px_rgba(217,70,239,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-fuchsia-300/70',

    idle: 'border-fuchsia-500/20 bg-slate-900/40 text-fuchsia-300/50 opacity-60 hover:opacity-90 hover:bg-fuchsia-950/30 hover:border-fuchsia-500/40',

    dot: 'bg-fuchsia-400/70',

    activeDot: 'bg-fuchsia-200 shadow-[0_0_6px_rgba(240,171,252,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-knowledgeBase',

  },

  backend: {

    active:

      'border-amber-300 bg-amber-900/80 text-amber-50 shadow-[0_0_14px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-300/70',

    idle: 'border-amber-500/20 bg-slate-900/40 text-amber-300/50 opacity-60 hover:opacity-90 hover:bg-amber-950/30 hover:border-amber-500/40',

    dot: 'bg-amber-400/70',

    activeDot: 'bg-amber-200 shadow-[0_0_6px_rgba(252,211,77,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-backend',

  },

  prompts: {

    active:

      'border-sky-300 bg-sky-900/85 text-sky-50 shadow-[0_0_14px_rgba(56,189,248,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-sky-300/70',

    idle: 'border-sky-500/20 bg-slate-900/40 text-sky-300/50 opacity-60 hover:opacity-90 hover:bg-sky-950/30 hover:border-sky-500/40',

    dot: 'bg-sky-400/70',

    activeDot: 'bg-sky-200 shadow-[0_0_6px_rgba(125,211,252,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-prompts',

  },

  errorHandling: {

    active:

      'border-rose-300 bg-rose-900/80 text-rose-50 shadow-[0_0_14px_rgba(251,113,133,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-rose-300/70',

    idle: 'border-rose-500/20 bg-slate-900/40 text-rose-300/50 opacity-60 hover:opacity-90 hover:bg-rose-950/30 hover:border-rose-500/40',

    dot: 'bg-rose-400/70',

    activeDot: 'bg-rose-200 shadow-[0_0_6px_rgba(253,164,175,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-errorHandling',

  },

  dati: {

    active:

      'border-emerald-300 bg-emerald-900/80 text-emerald-50 shadow-[0_0_14px_rgba(52,211,153,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-emerald-300/70',

    idle: 'border-emerald-500/20 bg-slate-900/40 text-emerald-300/50 opacity-60 hover:opacity-90 hover:bg-emerald-950/30 hover:border-emerald-500/40',

    dot: 'bg-emerald-400/70',

    activeDot: 'bg-emerald-200 shadow-[0_0_6px_rgba(153,246,228,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-dati',

  },

  voce: {

    active:

      'border-teal-300 bg-teal-900/80 text-teal-50 shadow-[0_0_14px_rgba(45,212,191,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-teal-300/70',

    idle: 'border-teal-500/20 bg-slate-900/40 text-teal-300/50 opacity-60 hover:opacity-90 hover:bg-teal-950/30 hover:border-teal-500/40',

    dot: 'bg-teal-400/70',

    activeDot: 'bg-teal-200 shadow-[0_0_6px_rgba(153,246,228,0.9)]',

    glowClass: 'omnia-tutor-tab-active omnia-tutor-tab-active-voce',

  },

};



export function TutorTabs({

  activePhase,

  phaseCompletion,

  onSelectPhase,

}: TutorTabsProps): React.ReactElement {

  return (

    <nav

      className="flex shrink-0 flex-wrap gap-1 border-b border-slate-700/60 px-2 py-2"

      aria-label="Fasi tutor"

    >

      {TUTOR_PHASE_ORDER.map((phase) => {

        const key = tutorPhaseKeyFromId(phase);

        const styles = TAB_STYLES[key];

        const isActive = phase === activePhase;

        const complete = phaseCompletion[phase] === true;

        return (

          <button

            key={phase}

            type="button"

            onClick={() => onSelectPhase(phase)}

            aria-current={isActive ? 'page' : undefined}

            className={[

              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200',

              isActive ? `z-[1] scale-[1.03] ${styles.active} ${styles.glowClass}` : styles.idle,

            ].join(' ')}

          >

            <span

              className={[

                'h-1.5 w-1.5 shrink-0 rounded-full',

                complete ? 'bg-emerald-400' : isActive ? styles.activeDot : styles.dot,

                complete && isActive ? 'shadow-[0_0_6px_rgba(52,211,153,0.9)]' : '',

              ].join(' ')}

              aria-hidden

            />

            {TUTOR_PHASE_LABELS[phase]}

          </button>

        );

      })}

    </nav>

  );

}


