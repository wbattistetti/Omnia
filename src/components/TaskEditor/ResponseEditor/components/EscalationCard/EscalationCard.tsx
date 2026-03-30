import React, { useState } from 'react';
import { EscalationHeader } from './EscalationHeader';
import { EscalationTasksList } from './EscalationTasksList';
import { hasEscalationCard } from '@responseEditor/ddtUtils';

type EscalationCardProps = {
  escalation: any;
  escalationIdx: number;
  escalationName: string;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: any) => any) => void;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  onDeleteEscalation?: () => void;
  stepKey: string;
  hideHeader?: boolean;
  isHovered?: boolean;
  /** Single-escalation StepEditor layout: fill height so DnD covers the card / panel. */
  fillAvailableHeight?: boolean;
};

export function EscalationCard({
  escalation,
  escalationIdx,
  escalationName,
  color,
  translations,
  allowedActions,
  updateEscalation,
  updateSelectedNode,
  onDeleteEscalation,
  stepKey,
  hideHeader = false,
  isHovered = false,
  fillAvailableHeight = false,
}: EscalationCardProps) {
  const showCard = hasEscalationCard(stepKey);

  const tasks = escalation?.tasks ?? [];
  const isEmpty = tasks.length === 0;

  const [isExpanded, setIsExpanded] = useState(true);

  const effectiveIsExpanded = hideHeader ? true : isExpanded;

  /** Tree view (fascia): stretch content column to match strip height so empty DnD fills the row. */
  const stretchInFascia = Boolean(hideHeader && showCard);

  const list = (
    <EscalationTasksList
      escalation={escalation}
      escalationIdx={escalationIdx}
      color={color}
      translations={translations}
      allowedActions={allowedActions}
      updateEscalation={updateEscalation}
      updateSelectedNode={updateSelectedNode}
      stepKey={stepKey}
      fillAvailableHeight={fillAvailableHeight}
    />
  );

  if (!showCard) {
    if (fillAvailableHeight) {
      return (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'stretch',
          }}
        >
          {list}
        </div>
      );
    }
    return list;
  }

  const stretchOuter = fillAvailableHeight || stretchInFascia;

  return (
    <div
      data-escalation-index={escalationIdx}
      style={{
        padding: '0.5rem',
        backgroundColor: 'transparent',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        flex: stretchOuter ? 1 : '0 0 auto',
        minHeight: stretchOuter ? 0 : 'auto',
        overflow: 'visible',
        alignSelf: stretchOuter ? 'stretch' : undefined,
        width: stretchInFascia ? '100%' : undefined,
      }}
    >
      {!hideHeader && (
        <EscalationHeader
          name={escalationName}
          color={color}
          isHovered={isHovered}
          isExpanded={effectiveIsExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onDelete={onDeleteEscalation}
        />
      )}
      {effectiveIsExpanded && (
        <div
          style={{
            flex: fillAvailableHeight || (stretchInFascia && isEmpty) ? 1 : 'none',
            minHeight:
              fillAvailableHeight
                ? 0
                : stretchInFascia && isEmpty
                  ? '120px'
                  : isEmpty
                    ? '120px'
                    : 'auto',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {list}
        </div>
      )}
    </div>
  );
}
