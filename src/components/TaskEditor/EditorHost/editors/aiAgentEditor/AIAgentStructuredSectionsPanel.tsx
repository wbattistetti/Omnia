/**
 * Structured design phase: tabbed section editors (revision textarea per tab) plus Prompt finale (read-only).
 */

import React from 'react';
import {
  AGENT_STRUCTURED_SECTION_IDS,
  AGENT_STRUCTURED_SECTION_LABELS,
  type AgentStructuredSectionId,
} from './agentStructuredSectionIds';
import { AIAgentRevisionEditorShell } from './AIAgentRevisionEditorShell';
import type { StructuredSectionsRevisionState } from './structuredSectionsRevisionReducer';
import type { RevisionBatchOp } from './textRevisionLinear';

/** Synthetic tab id for the composed runtime prompt (read-only). */
export const PROMPT_FINALE_TAB = 'prompt_finale' as const;
export type StructuredPanelTab = AgentStructuredSectionId | typeof PROMPT_FINALE_TAB;

export interface IaSectionDiffPair {
  oldIaPrompt: string;
  newIaPrompt: string;
}

export interface AIAgentStructuredSectionsPanelProps {
  instanceId: string | undefined;
  runtimeMarkdown: string;
  sectionsState: StructuredSectionsRevisionState;
  readOnly: boolean;
  onApplyRevisionOps: (sectionId: AgentStructuredSectionId, ops: readonly RevisionBatchOp[]) => void;
  iaRevisionDiffBySection: Partial<Record<AgentStructuredSectionId, IaSectionDiffPair>> | null;
  onDismissIaRevisionForSection: (sectionId: AgentStructuredSectionId) => void;
  headerAction?: React.ReactNode;
}

export function AIAgentStructuredSectionsPanel({
  instanceId,
  runtimeMarkdown,
  sectionsState,
  readOnly,
  onApplyRevisionOps,
  iaRevisionDiffBySection,
  onDismissIaRevisionForSection,
  headerAction,
}: AIAgentStructuredSectionsPanelProps) {
  const suffix = instanceId || 'default';
  const [activeTab, setActiveTab] = React.useState<StructuredPanelTab>('behavior_spec');

  React.useEffect(() => {
    setActiveTab('behavior_spec');
  }, [instanceId]);

  const isPromptFinale = activeTab === PROMPT_FINALE_TAB;
  const activeSectionId: AgentStructuredSectionId | null = isPromptFinale ? null : activeTab;
  const activeSlice = activeSectionId ? sectionsState[activeSectionId] : null;
  const activeDiff = activeSectionId ? iaRevisionDiffBySection?.[activeSectionId] : undefined;

  const tabListId = React.useId();
  const tabPanelId = `${tabListId}-panel`;

  return (
    <div className="space-y-4">
      {headerAction ? <div className="flex flex-wrap justify-end">{headerAction}</div> : null}

      <div className="rounded-md border border-slate-700 bg-slate-900/50 overflow-hidden">
        <div
          role="tablist"
          aria-label="Sezioni comportamento agente"
          className="flex flex-wrap gap-1 p-2 border-b border-slate-700 bg-slate-950/60 overflow-x-auto"
        >
          {AGENT_STRUCTURED_SECTION_IDS.map((sectionId) => {
            const selected = sectionId === activeTab;
            const hasIaDiff = Boolean(iaRevisionDiffBySection?.[sectionId]);
            const hasLocalEdits = sectionsState[sectionId].refinementOpLog.length > 0;
            return (
              <button
                key={sectionId}
                type="button"
                role="tab"
                id={`${tabListId}-tab-${sectionId}`}
                aria-selected={selected}
                aria-controls={tabPanelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(sectionId)}
                className={`relative shrink-0 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {AGENT_STRUCTURED_SECTION_LABELS[sectionId]}
                  {hasIaDiff ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-amber-400"
                      title="Diff IA disponibile"
                      aria-hidden
                    />
                  ) : null}
                  {!hasIaDiff && hasLocalEdits ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500/80"
                      title="Revisioni locali"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            id={`${tabListId}-tab-${PROMPT_FINALE_TAB}`}
            aria-selected={isPromptFinale}
            aria-controls={tabPanelId}
            tabIndex={isPromptFinale ? 0 : -1}
            onClick={() => setActiveTab(PROMPT_FINALE_TAB)}
            className={`shrink-0 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isPromptFinale
                ? 'bg-amber-700/90 text-amber-50 ring-1 ring-amber-500/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
            }`}
          >
            Prompt finale
          </button>
        </div>

        <div
          role="tabpanel"
          id={tabPanelId}
          aria-labelledby={
            isPromptFinale
              ? `${tabListId}-tab-${PROMPT_FINALE_TAB}`
              : `${tabListId}-tab-${activeTab}`
          }
          className="p-2"
        >
          {isPromptFinale ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500">
                Markdown composito da tutte le sezioni — non modificabile.
              </p>
              <textarea
                readOnly
                value={runtimeMarkdown}
                aria-label="Prompt finale runtime (sola lettura)"
                className="w-full min-h-[280px] rounded-md border border-slate-700 bg-[#0c1222] p-3 text-sm font-mono text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-amber-600/40 cursor-default"
                spellCheck={false}
              />
            </div>
          ) : activeSectionId && activeSlice ? (
            <AIAgentRevisionEditorShell
              key={activeSectionId}
              instanceId={`${suffix}-${activeSectionId}`}
              promptBaseText={activeSlice.promptBaseText}
              deletedMask={activeSlice.deletedMask}
              inserts={activeSlice.inserts}
              onApplyRevisionOps={(ops) => onApplyRevisionOps(activeSectionId, ops)}
              readOnly={readOnly}
              iaRevisionDiff={
                activeDiff
                  ? { oldIaPrompt: activeDiff.oldIaPrompt, newIaPrompt: activeDiff.newIaPrompt }
                  : null
              }
              onDismissIaRevisionDiff={() => onDismissIaRevisionForSection(activeSectionId)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
