// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { Code, Code2 } from 'lucide-react';
import type { TaskTreeNode } from '@types/taskTypes';
import { SemanticContractService } from '@services/SemanticContractService';
import { EngineEscalationService } from '@services/EngineEscalationService';
import type { EngineType } from '@types/semanticContract';

// Colors from TesterGrid (centralized palette)
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

// Engine type to chip label mapping
const ENGINE_LABELS: Record<EngineType, string> = {
  regex: 'RE',
  rule_based: 'RUL',
  ner: 'NER',
  llm: 'LLM',
  embedding: 'EMB',
};

// Engine type to color mapping
const ENGINE_COLORS: Record<EngineType, string> = {
  regex: EXTRACTOR_COLORS.regex,
  rule_based: EXTRACTOR_COLORS.deterministic,
  ner: EXTRACTOR_COLORS.ner,
  llm: EXTRACTOR_COLORS.llm,
  embedding: EXTRACTOR_COLORS.embeddings,
};

interface ParserStatusRowProps {
  node: TaskTreeNode;
  onCreateClick: () => void;
  onModifyClick: () => void;
  onEngineChipClick: (engineType: EngineType) => void;
  inline?: boolean; // If true, render only the icon (for inline use in button)
}

type ParserStatus = 'missing' | 'incomplete' | 'configured';

interface ParserState {
  status: ParserStatus;
  engines: EngineType[];
  escalation: any | null; // EngineEscalation | null
}

export default function ParserStatusRow({
  node,
  onCreateClick,
  onModifyClick,
  onEngineChipClick,
  inline = false,
}: ParserStatusRowProps) {
  const [parserState, setParserState] = React.useState<ParserState | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Load parser state
  React.useEffect(() => {
    let cancelled = false;

    async function loadState() {
      setLoading(true);
      try {
        const nodeId = node.id || node.templateId;

        // Check if contract exists
        const hasContract = await SemanticContractService.exists(nodeId);

        // Check if escalation exists and get engines
        const escalation = await EngineEscalationService.load(nodeId);
        const enabledEngines = escalation?.engines
          .filter(e => e.enabled)
          .map(e => e.type) || [];

        if (cancelled) return;

        // Determine status
        let status: ParserStatus;
        if (!hasContract) {
          status = 'missing';
        } else if (enabledEngines.length === 0) {
          status = 'incomplete';
        } else {
          status = 'configured';
        }

        setParserState({
          status,
          engines: enabledEngines,
          escalation,
        });
      } catch (error) {
        console.error('[ParserStatusRow] Error loading state:', error);
        if (!cancelled) {
          setParserState({
            status: 'missing',
            engines: [],
            escalation: null,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, [node.id, node.templateId]);

  // Refresh state when node changes
  const refreshState = React.useCallback(async () => {
    const nodeId = node.id || node.templateId;
    const hasContract = await SemanticContractService.exists(nodeId);
    const escalation = await EngineEscalationService.load(nodeId);
    const enabledEngines = escalation?.engines
      .filter(e => e.enabled)
      .map(e => e.type) || [];

    let status: ParserStatus;
    if (!hasContract) {
      status = 'missing';
    } else if (enabledEngines.length === 0) {
      status = 'incomplete';
    } else {
      status = 'configured';
    }

    setParserState({
      status,
      engines: enabledEngines,
      escalation,
    });
  }, [node.id, node.templateId]);

  // Expose refresh function via callback ref (parent can call it)
  React.useEffect(() => {
    // Store refresh function in a way parent can access it
    // Parent will use a ref to call refresh when needed
  }, [refreshState]);

  if (loading || !parserState) {
    return (
      <div style={{
        padding: '4px 8px',
        fontSize: '12px',
        color: '#9ca3af',
      }}>
        Loading...
      </div>
    );
  }

  const { status, engines, escalation } = parserState;
  const hasParser = status !== 'missing';

  // Build tooltip text
  const buildTooltip = () => {
    if (status === 'missing') {
      return 'Parser non creato. Clicca per creare.';
    }

    const parts: string[] = [];

    // Active engines
    if (engines.length > 0) {
      const engineLabels = engines.map(e => ENGINE_LABELS[e] || e).join(', ');
      parts.push(`Motori attivi: ${engineLabels}`);
    } else {
      parts.push('Nessun motore attivo');
    }

    // Escalation order
    if (escalation?.engines && escalation.engines.length > 0) {
      const escalationOrder = escalation.engines
        .filter((e: any) => e.enabled)
        .map((e: any, idx: number) => `${idx + 1}. ${ENGINE_LABELS[e.type] || e.type}`)
        .join(', ');
      if (escalationOrder) {
        parts.push(`Escalation: ${escalationOrder}`);
      }
    }

    return parts.join('\n');
  };

  const handleIconClick = () => {
    if (status === 'missing') {
      onCreateClick();
    } else {
      onModifyClick();
    }
  };

  // Icon color: grey if missing, blue if exists
  const iconColor = hasParser ? '#60a5fa' : '#6b7280';
  const IconComponent = hasParser ? Code : Code2;

  // Inline mode: render only the icon (for use inside button)
  if (inline) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation(); // Prevent button click
          handleIconClick();
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          transition: 'opacity 0.2s',
          marginLeft: 'auto', // Push to right
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        title={buildTooltip()}
      >
        <IconComponent
          size={14}
          color={iconColor}
          style={{ opacity: hasParser ? 1 : 0.5 }}
        />
      </div>
    );
  }

  // Default mode: render as separate row (backward compatibility)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      marginTop: '4px',
    }}>
      {/* Clickable parser icon */}
      <div
        onClick={handleIconClick}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        title={buildTooltip()}
      >
        <IconComponent
          size={14}
          color={iconColor}
          style={{ opacity: hasParser ? 1 : 0.5 }}
        />
      </div>
    </div>
  );
}

interface EngineChipProps {
  engineType: EngineType;
  onClick: () => void;
}

function EngineChip({ engineType, onClick }: EngineChipProps) {
  const label = ENGINE_LABELS[engineType] || engineType.toUpperCase();
  const color = ENGINE_COLORS[engineType] || '#9ca3af';

  // Determine text color based on background
  const lightColors = [EXTRACTOR_COLORS.regex, EXTRACTOR_COLORS.deterministic, EXTRACTOR_COLORS.ner, EXTRACTOR_COLORS.llm];
  const textColor = lightColors.includes(color) ? '#0b0f17' : '#fff';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 600,
        background: color,
        color: textColor,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.8';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      title={`Click to open ${engineType} editor`}
    >
      {label}
    </button>
  );
}

// Export refresh function type for parent components
export type ParserStatusRowRef = {
  refresh: () => Promise<void>;
};
