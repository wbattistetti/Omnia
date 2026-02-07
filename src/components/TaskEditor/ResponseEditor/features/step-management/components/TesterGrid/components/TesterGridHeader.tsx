import React, { useMemo } from 'react';
import TesterGridInput from './TesterGridInput';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import TesterGridHeaderColumn from './TesterGridHeaderColumn';
import AddContractDropdown from './AddContractDropdown';
import type { DataContract, ContractType } from '@components/DialogueDataEngine/contracts/contractLoader';

// 🎨 Colori centralizzati per extractors
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
};

// 📊 Etichette colonne con tooltip
const COLUMN_LABELS = {
  regex: {
    main: "Espressione",
    tech: "Regex",
    tooltip: "Cerca pattern di testo con espressioni regolari"
  },
  deterministic: {
    main: "Logica",
    tech: "Extractor",
    tooltip: "Parsing semantico con regole programmate specifiche per tipo"
  },
  ner: {
    main: "AI Rapida",
    tech: "NER",
    tooltip: "Riconoscimento entità con intelligenza artificiale veloce"
  },
  llm: {
    main: "AI Completa",
    tech: "LLM",
    tooltip: "Comprensione linguistica profonda con modello AI avanzato"
  },
  embeddings: {
    main: "Classificazione",
    tech: "Embeddings",
    tooltip: "Classificazione intenti basata su embeddings semantici"
  }
};

interface TesterGridHeaderProps {
  contract?: DataContract | null;
  newExample: string;
  setNewExample: (value: string) => void;
  onAddExample: () => void;
  phraseColumnWidth: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  enabledMethods: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
  toggleMethod: (method: keyof TesterGridHeaderProps['enabledMethods']) => void;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  openEditor?: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  showDeterministic: boolean;
  showNER: boolean;
  showEmbeddings: boolean;
  headerRowRef: React.RefObject<HTMLTableRowElement>;
  onContractChange?: (contract: DataContract | null) => void;
}

/**
 * Header component for the tester grid
 */
export default function TesterGridHeader({
  contract,
  newExample,
  setNewExample,
  onAddExample,
  phraseColumnWidth,
  isResizing,
  onResizeStart,
  enabledMethods,
  toggleMethod,
  activeEditor,
  toggleEditor,
  openEditor,
  showDeterministic,
  showNER,
  showEmbeddings,
  headerRowRef,
  onContractChange,
}: TesterGridHeaderProps) {
  // State per gestire quale colonna ha il dropdown "+" aperto
  const [openDropdownAfter, setOpenDropdownAfter] = React.useState<string | null>(null);

  // Leggi contracts dal dataContract - ordine implicito (ordine array = ordine escalation)
  const contracts = useMemo(() => {
    if (!contract?.contracts || !Array.isArray(contract.contracts)) {
      return [];
    }
    // Filtra solo i contract con enabled: true
    return contract.contracts.filter(c => c.enabled !== false);
  }, [contract?.contracts]);

  // Map contract type to component type
  const mapContractTypeToComponentType = (type: ContractType): 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings' => {
    if (type === 'rules') return 'deterministic';
    return type;
  };

  // Get available methods (excluding already added ones)
  const getAvailableMethods = (): ContractType[] => {
    const allMethods: ContractType[] = ['regex', 'rules', 'ner', 'llm', 'embeddings'];
    if (!contracts || contracts.length === 0) return allMethods;
    const usedTypes = contracts.map(c => c.type);
    return allMethods.filter(m => !usedTypes.includes(m));
  };

  // Handle adding contract after a specific column
  const handleAddContractAfter = (insertAfterType: ContractType) => {
    return (newType: ContractType) => {
      if (!contract || !onContractChange) {
        console.warn('[TesterGridHeader][handleAddContractAfter] Missing contract or callback');
        return;
      }

      const currentContracts = contracts || [];
      const insertIndex = currentContracts.findIndex(c => c.type === insertAfterType) + 1;

      // Crea nuovo contract item
      const newContractItem = createDefaultContract(newType);

      // Inserisci nel posto corretto
      const newContracts = [
        ...currentContracts.slice(0, insertIndex),
        newContractItem,
        ...currentContracts.slice(insertIndex),
      ];

      const updatedContract: DataContract = {
        ...contract,
        contracts: newContracts,
      };

      setOpenDropdownAfter(null);
      onContractChange(updatedContract);
    };
  };

  // Helper: Crea contract item di default per tipo
  const createDefaultContract = (type: ContractType): any => {
    const base = { type, enabled: true };
    switch (type) {
      case 'regex':
        return { ...base, patterns: [], examples: [], testCases: [] };
      case 'rules':
        return { ...base, extractorCode: '', validators: [], testCases: [] };
      case 'ner':
        return { ...base, entityTypes: [], confidence: 0.8 };
      case 'llm':
        return { ...base, systemPrompt: '', userPromptTemplate: '', responseSchema: {} };
      case 'embeddings':
        return { ...base, intents: [] };
      default:
        return base;
    }
  };

  // Handle adding first contract (when no contract exists)
  const handleAddFirstContract = (type: ContractType) => {
    if (!onContractChange) {
      console.warn('[TesterGridHeader][handleAddFirstContract] No onContractChange callback');
      return;
    }

    const newContractItem = createDefaultContract(type);
    const newContract: DataContract = {
      templateName: contract?.templateName ?? '',
      templateId: contract?.templateId || '',
      subDataMapping: contract?.subDataMapping || {},
      contracts: [newContractItem],
    };

    onContractChange(newContract);
  };

  // Handle removing a contract
  const handleRemoveContract = (typeToRemove: ContractType) => {
    if (!contract || !onContractChange) return;

    const newContracts = contracts.filter(c => c.type !== typeToRemove);

    if (newContracts.length === 0) {
      // Se non ci sono più contratti, rimuovi tutto
      onContractChange(null);
      return;
    }

    const updatedContract: DataContract = {
      ...contract,
      contracts: newContracts,
    };

    onContractChange(updatedContract);
  };

  // ✅ FIX: Calculate column width for dynamic columns
  // Assume: phraseColumnWidth (280px) + Actions (80px) + Buttons (80px) = 440px fixed
  // Remaining width is distributed among dynamic columns
  const calculateColumnWidth = (totalColumns: number): number => {
    if (totalColumns === 0) return 200; // Default width if no columns
    // Estimate: 100% - 440px fixed = available width
    // Distribute evenly among dynamic columns (min 220px per column per contenere "Espressione (Regex)" + icone)
    const minColumnWidth = 220; // Increased from 150 to 220 to prevent text clipping
    const estimatedTotalWidth = 1200; // Approximate table width
    const fixedWidth = 440; // phraseColumnWidth (280) + Actions (80) + Buttons (80)
    const availableWidth = estimatedTotalWidth - fixedWidth;
    const calculatedWidth = Math.max(minColumnWidth, Math.floor(availableWidth / totalColumns));
    return calculatedWidth;
  };

  // Render dynamic columns based on contracts array
  const renderDynamicColumns = () => {
    if (!contracts || contracts.length === 0) {
      // Show "Add contract" dropdown when no contract
      return (
        <th colSpan={1} style={{ padding: 8, background: '#f9fafb', textAlign: 'center', width: '200px' }}>
          <AddContractDropdown
            onSelect={handleAddFirstContract}
            availableMethods={getAvailableMethods()}
            label="Aggiungi contract"
          />
        </th>
      );
    }

    const columnWidth = calculateColumnWidth(contracts.length);

    return contracts.map((contractItem, index) => {
      const componentType = mapContractTypeToComponentType(contractItem.type);
      const labels = COLUMN_LABELS[componentType] || COLUMN_LABELS.regex;
      const color = EXTRACTOR_COLORS[componentType] || EXTRACTOR_COLORS.regex;
      const enabled = contractItem.enabled !== false;

      // Map to enabledMethods prop (for backward compatibility)
      const enabledMethodKey = componentType === 'deterministic' ? 'deterministic' : componentType;
      const isEnabledInProps = enabledMethods[enabledMethodKey as keyof typeof enabledMethods] ?? false;

      // Get available methods for this column
      const availableMethods = getAvailableMethods();
      const isDropdownOpen = openDropdownAfter === contractItem.type;

      return (
        <TesterGridHeaderColumn
          key={contractItem.type}
          type={componentType}
          contractType={contractItem.type}
          mainLabel={labels.main}
          techLabel={labels.tech}
          tooltip={labels.tooltip}
          backgroundColor={color}
          enabled={isEnabledInProps}
          activeEditor={activeEditor}
          onToggleMethod={() => toggleMethod(enabledMethodKey as keyof typeof enabledMethods)}
          onToggleEditor={openEditor ? (type) => openEditor(type) : toggleEditor}
          showPostProcess={componentType === 'deterministic'}
          onAddContract={availableMethods.length > 0 && onContractChange ? () => {
            // Toggle dropdown for this column
            setOpenDropdownAfter(isDropdownOpen ? null : contractItem.type);
          } : undefined}
          availableMethods={availableMethods}
          isDropdownOpen={isDropdownOpen}
          onSelectMethod={onContractChange ? (selectedMethod) => {
            handleAddContractAfter(contractItem.type)(selectedMethod);
            setOpenDropdownAfter(null);
          } : undefined}
          columnWidth={columnWidth}
          onRemoveContract={onContractChange && contracts.length > 1 ? () => handleRemoveContract(contractItem.type) : undefined}
        />
      );
    });
  };

  return (
    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <tr ref={headerRowRef}>
        <th style={{
          textAlign: 'left',
          padding: 8,
          background: '#f9fafb',
          width: `${phraseColumnWidth}px`,
          position: 'sticky',
          left: 0,
          zIndex: 1002, // Higher zIndex to ensure input is always clickable
        }}>
          <TesterGridInput
            value={newExample}
            onChange={setNewExample}
            onAdd={onAddExample}
          />
          {/* Splitter - linea verticale draggable */}
          <div
            onMouseDown={onResizeStart}
            style={{
              position: 'absolute',
              right: '-3px',
              top: 0,
              bottom: 0,
              width: '6px',
              cursor: 'col-resize',
              backgroundColor: isResizing ? '#3b82f6' : 'rgba(107, 114, 128, 0.4)',
              zIndex: 20,
              transition: isResizing ? 'none' : 'background-color 0.2s',
              borderLeft: '1px solid rgba(107, 114, 128, 0.6)',
              borderRight: '1px solid rgba(107, 114, 128, 0.6)'
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.6)';
                (e.currentTarget as HTMLElement).style.borderLeftColor = '#3b82f6';
                (e.currentTarget as HTMLElement).style.borderRightColor = '#3b82f6';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(107, 114, 128, 0.4)';
                (e.currentTarget as HTMLElement).style.borderLeftColor = 'rgba(107, 114, 128, 0.6)';
                (e.currentTarget as HTMLElement).style.borderRightColor = 'rgba(107, 114, 128, 0.6)';
              }
            }}
          />
        </th>
        <TesterGridActionsColumn rowIndex={-1} newExample={newExample} onAddExample={onAddExample} phraseColumnWidth={phraseColumnWidth} />
        {/* Render dynamic columns based on contracts array */}
        {contracts && contracts.length > 0 ? (
          renderDynamicColumns()
        ) : (
          // Show "Add contract" dropdown when no contract
          <th colSpan={1} style={{ padding: 8, background: '#f9fafb', textAlign: 'center' }}>
            <AddContractDropdown
              onSelect={handleAddFirstContract}
              availableMethods={getAvailableMethods()}
              label="Aggiungi contract"
            />
          </th>
        )}
      </tr>
    </thead>
  );
}
