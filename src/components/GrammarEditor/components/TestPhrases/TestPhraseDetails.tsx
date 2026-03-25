// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Renders hierarchical match details for grammar test phrases (slot / semantic / linguistic).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowRight, Pencil, MessageSquare } from 'lucide-react';
import { TestPhrase, MatchDetail } from './TestPhrases';
import type { Grammar } from '../../types/grammarTypes';

interface TestPhraseDetailsProps {
  phrase: TestPhrase;
  grammar: Grammar | null;
}

export function TestPhraseDetails({ phrase, grammar }: TestPhraseDetailsProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!phrase.result || !phrase.result.success) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: '#ef4444',
        fontSize: '14px',
      }}>
        No match found
      </div>
    );
  }

  const matchDetails = phrase.result.matchDetails || [];
  const hasMultipleMatches = matchDetails.length > 1;

  return (
    <div style={{ padding: '16px' }}>
      {/* Tree structure */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '8px',
        backgroundColor: '#fff',
      }}>
        {matchDetails.length > 0 ? (
          matchDetails.map((detail, index) => (
            <div key={detail.id}>
              {/* Show "Match #N" header only if multiple matches */}
              {hasMultipleMatches && (
                <div style={{
                  marginTop: index > 0 ? '16px' : '0',
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#fff',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#10b981',
                      borderRadius: '1px',
                    }} />
                  </div>
                  Match #{index + 1}
                </div>
              )}
              <MatchDetailNode
                key={detail.id}
                detail={detail}
                level={0}
                expandedNodes={expandedNodes}
                onToggle={toggleNode}
              />
            </div>
          ))
        ) : (
          <div style={{ padding: '12px', color: '#6b7280', fontSize: '12px' }}>
            No match details available
          </div>
        )}
      </div>
    </div>
  );
}

/** Designer-aligned accent for captured linguistic surface form (cyan / sky family). */
const LINGUISTIC_DISPLAY_COLOR = '#22d3ee';

function hasLinguisticDescendant(detail: MatchDetail): boolean {
  if (detail.type === 'linguistic') return true;
  return (detail.children ?? []).some(hasLinguisticDescendant);
}

interface MatchDetailNodeProps {
  detail: MatchDetail;
  level: number;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
}

function MatchDetailNode({
  detail,
  level,
  expandedNodes,
  onToggle,
}: MatchDetailNodeProps) {
  const hasChildren = detail.children && detail.children.length > 0;
  const isExpanded = expandedNodes.has(detail.id);
  const showSemanticValueSuffix =
    Boolean(detail.semanticValue) && !hasLinguisticDescendant(detail);
  const linguisticDisplayText = (detail.linguisticText ?? detail.label).trim();

  // Get icon based on type (same as Grammar Editor)
  const getIcon = () => {
    const iconSize = 14;
    switch (detail.type) {
      case 'slot':
        return <ArrowRight size={iconSize} color="#10b981" />; // Green
      case 'semantic-value':
        return <Pencil size={iconSize} color="#fb923c" />; // Orange
      case 'linguistic':
        return <MessageSquare size={iconSize} color="#fde047" />; // Yellow
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Node header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 0',
          paddingLeft: `${level * 16}px`,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && onToggle(detail.id)}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={14} style={{ marginRight: '4px', color: '#6b7280' }} />
          ) : (
            <ChevronRight size={14} style={{ marginRight: '4px', color: '#6b7280' }} />
          )
        ) : (
          <div style={{ width: '18px', marginRight: '4px' }} />
        )}

        {/* Icon (ArrowRight, Pencil, or MessageSquare) */}
        <div style={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
          {getIcon()}
        </div>

        {/* Label: linguistic leaf uses quoted italic cyan to match designer surface-form styling */}
        {detail.type === 'linguistic' ? (
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: LINGUISTIC_DISPLAY_COLOR,
              fontStyle: 'italic',
            }}
          >
            {`"${linguisticDisplayText}"`}
          </span>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{detail.label}</span>
        )}

        {/* Matched text next to semantic node only when no linguistic row below (avoids duplicate) */}
        {showSemanticValueSuffix && (
          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px', fontStyle: 'italic' }}>
            ({detail.semanticValue})
          </span>
        )}
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && detail.children!.map((child) => (
        <MatchDetailNode
          key={child.id}
          detail={child}
          level={level + 1}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
