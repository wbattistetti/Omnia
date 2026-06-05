/**
 * Editor analisi documento KB: sezioni ### in accordion; note riformattazione in coda.
 */

import React from 'react';
import {
  parseKbAnalysisSections,
  patchKbAnalysisSectionBody,
} from '@domain/knowledgeBase/kbDocumentAnalysisSections';
import {
  kbAnalysisSectionDisplayBadge,
  kbAnalysisSectionHeadingToneClass,
  prepareKbAnalysisSectionsForDisplay,
} from '@domain/knowledgeBase/kbDocumentAnalysisLite';
import { KbAnalysisEditableMonaco } from './KbAnalysisEditableMonaco';
import { KbDocumentAnalysisSectionWithReview } from './KbDocumentAnalysisSectionWithReview';
import { KbAnalysisSectionAccordion } from './KbAnalysisSectionAccordion';

export type KbDocumentAnalysisWorkspaceProps = {
  draft: string;
  agentBaseline: string;
  onDraftChange: (next: string) => void;
  readOnly?: boolean;
  /** Note meta riformattazione (### …) — accordion in tab Analisi. */
  restructureNotesMarkdown?: string;
  onRestructureNotesChange?: (next: string) => void;
};

function KbAnalysisPlainSection({
  heading,
  value,
  onValueChange,
  readOnly,
  defaultOpen,
  badge,
  headingToneClass,
}: {
  heading: string;
  value: string;
  onValueChange: (next: string) => void;
  readOnly?: boolean;
  defaultOpen?: boolean;
  badge?: string;
  headingToneClass?: string;
}): React.ReactElement {
  return (
    <KbAnalysisSectionAccordion
      heading={heading}
      defaultOpen={defaultOpen}
      badge={badge}
      headingToneClass={headingToneClass}
    >
      <KbAnalysisEditableMonaco
        value={value}
        agentBaseline=""
        onChange={onValueChange}
        readOnly={readOnly}
        minHeightPx={72}
        ariaLabel={`Nota riformattazione: ${heading}`}
      />
    </KbAnalysisSectionAccordion>
  );
}

export function KbDocumentAnalysisWorkspace({
  draft,
  agentBaseline,
  onDraftChange,
  readOnly = false,
  restructureNotesMarkdown = '',
  onRestructureNotesChange,
}: KbDocumentAnalysisWorkspaceProps): React.ReactElement {
  const parsed = React.useMemo(() => parseKbAnalysisSections(draft), [draft]);
  const visibleSections = React.useMemo(
    () => prepareKbAnalysisSectionsForDisplay(parsed.sections),
    [parsed.sections]
  );
  const notesParsed = React.useMemo(
    () => parseKbAnalysisSections(restructureNotesMarkdown),
    [restructureNotesMarkdown]
  );

  if (visibleSections.length === 0 && notesParsed.sections.length === 0 && !parsed.preamble.trim()) {
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

  const patchNotesSection = (sectionId: string, body: string) => {
    if (!onRestructureNotesChange) return;
    onRestructureNotesChange(
      patchKbAnalysisSectionBody(restructureNotesMarkdown, sectionId as `kbSection:${string}`, body)
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
      {parsed.preamble.trim() ? (
        <KbAnalysisSectionAccordion
          heading="Tipo documento"
          defaultOpen={visibleSections.length === 0}
          headingToneClass="text-sky-300/90"
        >
          <KbAnalysisEditableMonaco
            value={parsed.preamble}
            agentBaseline=""
            onChange={(next) => {
              const rebuilt = parseKbAnalysisSections(draft);
              const sectionsPart = rebuilt.sections
                .map((s) => `### ${s.heading}\n\n${s.body}`)
                .join('\n\n');
              onDraftChange([next.trim(), sectionsPart].filter(Boolean).join('\n\n'));
            }}
            readOnly={readOnly}
            minHeightPx={72}
            ariaLabel="Preambolo analisi documento"
          />
        </KbAnalysisSectionAccordion>
      ) : null}

      {visibleSections.map((section, i) => (
        <KbDocumentAnalysisSectionWithReview
          key={section.id}
          sectionId={section.id}
          heading={section.heading}
          value={section.body}
          readOnly={readOnly}
          defaultOpen={i === 0 && notesParsed.sections.length === 0}
          badge={kbAnalysisSectionDisplayBadge(section.heading)}
          headingToneClass={kbAnalysisSectionHeadingToneClass(section.heading)}
          onValueChange={(body) => onDraftChange(patchKbAnalysisSectionBody(draft, section.id, body))}
        />
      ))}

      {notesParsed.sections.length > 0 ? (
        <div className="mt-1 space-y-1.5 border-t border-teal-900/40 pt-2">
          {notesParsed.sections.map((section, i) => (
            <KbAnalysisPlainSection
              key={`restructure-${section.id}`}
              heading={section.heading.replace(/^Riformattazione — /i, '')}
              value={section.body}
              readOnly={readOnly || !onRestructureNotesChange}
              defaultOpen={i === 0 && visibleSections.length === 0}
              badge="Riformattazione"
              headingToneClass="text-teal-300/90"
              onValueChange={(body) => patchNotesSection(section.id, body)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
