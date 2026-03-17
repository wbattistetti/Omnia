// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

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

  return (
    <div style={{ padding: '16px' }}>
      {/* Match #1 Header */}
      <div style={{
        padding: '12px',
        backgroundColor: '#10b981',
        color: '#fff',
        borderRadius: '6px 6px 0 0',
        fontWeight: 600,
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          backgroundColor: '#fff',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#10b981',
            borderRadius: '1px',
          }} />
        </div>
        Match #1
      </div>

      {/* Tree structure */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderTop: 'none',
        borderRadius: '0 0 6px 6px',
        padding: '8px',
        backgroundColor: '#fff',
      }}>
        {phrase.result.matchDetails && phrase.result.matchDetails.length > 0 ? (
          phrase.result.matchDetails.map((detail) => (
            <MatchDetailNode
              key={detail.id}
              detail={detail}
              level={0}
              expandedNodes={expandedNodes}
              onToggle={toggleNode}
            />
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

        {/* Label */}
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{detail.label}</span>

        {/* Semantic value (if present, show in parentheses) */}
        {detail.semanticValue && (
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
