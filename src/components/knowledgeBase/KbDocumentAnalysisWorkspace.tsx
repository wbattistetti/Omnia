/**
 * Editor analisi documento KB per sezioni ### con revisione designer.
 */

import React from 'react';
import {
  parseKbAnalysisSections,
  patchKbAnalysisSectionBody,
} from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import { KbAnalysisEditableMonaco } from './KbAnalysisEditableMonaco';
import { KbDocumentAnalysisSectionWithReview } from './KbDocumentAnalysisSectionWithReview';

export type KbDocumentAnalysisWorkspaceProps = {
  draft: string;
  agentBaseline: string;
  onDraftChange: (next: string) => void;
  readOnly?: boolean;
};

export function KbDocumentAnalysisWorkspace({
  draft,
  agentBaseline,
  onDraftChange,
  readOnly = false,
}: KbDocumentAnalysisWorkspaceProps): React.ReactElement {
  const parsed = React.useMemo(() => parseKbAnalysisSections(draft), [draft]);

  if (parsed.sections.length === 0) {
    return (
      <KbAnalysisEditableMonaco
        value={draft}
        agentBaseline={agentBaseline}
        onChange={onDraftChange}
        readOnly={readOnly}
        fillHeight
        ariaLabel="Analisi del documento in Markdown"
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
      {parsed.preamble.trim() ? (
        <div className="rounded border border-slate-800/80 bg-slate-950/40 px-2 py-2">
          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-400">
            {parsed.preamble}
          </pre>
        </div>
      ) : null}

      {parsed.sections.map((section, i) => (
        <KbDocumentAnalysisSectionWithReview
          key={section.id}
          sectionId={section.id}
          heading={section.heading}
          value={section.body}
          readOnly={readOnly}
          onValueChange={(body) =>
            onDraftChange(patchKbAnalysisSectionBody(draft, section.id, body))
          }
        />
      ))}
    </div>
  );
}
