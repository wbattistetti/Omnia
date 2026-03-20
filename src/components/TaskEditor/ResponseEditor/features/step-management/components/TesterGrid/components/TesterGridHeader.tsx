import React, { useMemo } from 'react';
import TesterGridInput from './TesterGridInput';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import TesterGridHeaderColumn from './TesterGridHeaderColumn';
import AddContractDropdown from './AddContractDropdown';
import type { DataContract, ContractType } from '@components/DialogueDataEngine/contracts/contractLoader';

// Helper: Get engines from contract
function getEngines(contract: DataContract | null): any[] {
  if (!contract) return [];
  return contract.engines || [];
}

// 🎨 Colori centralizzati per extractors
const EXTRACTOR_COLORS = {
  regex: '#93c5fd',
  deterministic: '#e5e7eb',
  ner: '#fef3c7',
  llm: '#fed7aa',
  embeddings: '#e0e7ff',
  grammarflow: '#c084fc', // Purple color for grammarflow
};

// 📊 Etichette colonne con tooltip
const COLUMN_LABELS = {
  regex: {
    main: "Regex",
    tech: "Regex",
    tooltip: "Riconosce il dato solo se è scritto in modo molto preciso e prevedibile. Funziona per risposte standard. Se la risposta è espressa in modo diverso, passa al motore successivo."
  },
  deterministic: {
    main: "Rules",
    tech: "Rules",
    tooltip: "Applica regole strutturate per estrarre informazioni composte, come indirizzi o dati personali. Funziona quando la risposta contiene più parti da separare. Se la risposta è troppo libera, passa al motore successivo."
  },
  ner: {
    main: "NER",
    tech: "NER",
    tooltip: "Capisce vari modi comuni di esprimere lo stesso concetto. Riconosce entità come nomi, luoghi o categorie anche se scritte in forme diverse. Interviene quando Regex non basta."
  },
  llm: {
    main: "LLM",
    tech: "LLM",
    tooltip: "Interpreta il linguaggio naturale in modo avanzato. Capisce risposte complesse, ambigue o discorsive. È il motore finale che interviene quando gli altri non riescono."
  },
  embeddings: {
    main: "Embeddings",
    tech: "Embeddings",
    tooltip: "Capisce sinonimi, parafrasi e modi molto diversi di dire la stessa cosa. Serve quando il dato richiesto appartiene a una lista di valori possibili. Trova il valore più simile anche se l'utente usa parole diverse."
  },
  grammarflow: {
    main: "GrammarFlow",
    tech: "GrammarFlow",
    tooltip: "Motore basato su grammatica visuale (flowchart). Permette di definire pattern complessi tramite un grafo di nodi e archi. Utile per riconoscere strutture linguistiche articolate."
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
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | 'grammarflow' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow') => void;
  openEditor?: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow') => void;
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

  // Leggi engines dal dataContract - ordine implicito (ordine array = ordine escalation)
  const engines = useMemo(() => {
    // ✅ DEBUG: Log dettagliato per capire perché le colonne non vengono mostrate
    const enginesArray = getEngines(contract);
    console.log('[TesterGridHeader] 🔍 Reading engines from DataContract', {
      hasContract: !!contract,
      contractType: contract ? typeof contract : 'null',
      hasEnginesArray: enginesArray.length > 0,
      enginesIsArray: Array.isArray(enginesArray),
      enginesRaw: enginesArray,
      enginesCount: enginesArray.length,
      enginesTypes: enginesArray.map((c: any) => c?.type) || [],
      contractKeys: contract ? Object.keys(contract) : []
    });

    if (!enginesArray || enginesArray.length === 0) {
      console.log('[TesterGridHeader] ⚠️ No engines array found, returning empty array');
      return [];
    }
    // ✅ CRITICAL: Show ALL engines (enabled and disabled) so user can toggle checkbox
    // Filtering for enabled engines happens during escalation execution, not in UI
    console.log('[TesterGridHeader] ✅ Engines loaded (all engines shown)', {
      totalEngines: enginesArray.length,
      enginesTypes: enginesArray.map(c => c.type),
      enabledCount: enginesArray.filter(c => c.enabled !== false).length
    });
    return enginesArray;
  }, [contract]);

  // Map contract type to component type
  const mapContractTypeToComponentType = (type: ContractType): 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings' | 'grammarflow' => {
    if (type === 'rules') return 'deterministic';
    return type;
  };

  // Get available methods (excluding already added ones)
  const getAvailableMethods = (): ContractType[] => {
    const allMethods: ContractType[] = ['regex', 'rules', 'ner', 'llm', 'embeddings', 'grammarflow'];
    if (!engines || engines.length === 0) return allMethods;
    const usedTypes = engines.map(c => c.type);
    return allMethods.filter(m => !usedTypes.includes(m));
  };

  // Handle adding contract after a specific column
  const handleAddContractAfter = (insertAfterType: ContractType) => {
    return (newType: ContractType) => {
      if (!contract || !onContractChange) {
        console.warn('[TesterGridHeader][handleAddContractAfter] Missing contract or callback');
        return;
      }

      const currentEngines = engines || [];
      const insertIndex = currentEngines.findIndex(c => c.type === insertAfterType) + 1;

      // Crea nuovo engine item
      const newEngineItem = createDefaultContract(newType);

      // Inserisci nel posto corretto
      const newEngines = [
        ...currentEngines.slice(0, insertIndex),
        newEngineItem,
        ...currentEngines.slice(insertIndex),
      ];

      const updatedContract: DataContract = {
        ...contract,
        engines: newEngines,
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
        return { ...base, systemPrompt: '', aiPrompt: '', responseSchema: {} };
      case 'embeddings':
        return { ...base, semanticValues: [] };
      case 'grammarflow':
        return { ...base, grammarFlow: null }; // Empty grammar, will be created in Grammar Editor
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

    const newEngineItem = createDefaultContract(type);
    const newContract: DataContract = {
      templateName: contract?.templateName ?? '',
      templateId: contract?.templateId || '',
      subDataMapping: contract?.subDataMapping || {},
      engines: [newEngineItem],
      outputCanonical: contract?.outputCanonical || { format: 'value' }
    };

    onContractChange(newContract);
  };

  // Handle removing a contract
  const handleRemoveContract = (typeToRemove: ContractType) => {
    if (!contract || !onContractChange) return;

    const newEngines = engines.filter(c => c.type !== typeToRemove);

    if (newEngines.length === 0) {
      // Se non ci sono più engine, rimuovi tutto
      onContractChange(null);
      return;
    }

    const updatedContract: DataContract = {
      ...contract,
      engines: newEngines,
    };

    onContractChange(updatedContract);
  };

  // ✅ FIX: Calculate column width for dynamic columns
  // Assume: phraseColumnWidth (280px) + Actions (80px) + Buttons (80px) = 440px fixed
  // Remaining width is distributed among dynamic columns
  const calculateColumnWidth = (totalColumns: number): number => {
    if (totalColumns === 0) return 200; // Default width if no columns
    // Estimate: 100% - 440px fixed = available width
    // Distribute evenly among dynamic columns (min 220px per column per contenere label + icone)
    const minColumnWidth = 220; // Increased from 150 to 220 to prevent text clipping
    const estimatedTotalWidth = 1200; // Approximate table width
    const fixedWidth = 440; // phraseColumnWidth (280) + Actions (80) + Buttons (80)
    const availableWidth = estimatedTotalWidth - fixedWidth;
    const calculatedWidth = Math.max(minColumnWidth, Math.floor(availableWidth / totalColumns));
    return calculatedWidth;
  };

  // Render dynamic columns based on engines array
  const renderDynamicColumns = () => {
    // ✅ DEBUG: Log per capire perché le colonne non vengono renderizzate
    console.log('[TesterGridHeader] 🔍 renderDynamicColumns called', {
      enginesCount: engines?.length || 0,
      enginesTypes: engines?.map(c => c.type) || [],
      willShowAddContract: !engines || engines.length === 0,
      willShowColumns: engines && engines.length > 0
    });

    if (!engines || engines.length === 0) {
      // Show "Add contract" dropdown when no engine
      console.log('[TesterGridHeader] ⚠️ No engines found, showing "Add contract" dropdown');
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

    console.log('[TesterGridHeader] ✅ Rendering columns for engines', {
      enginesCount: engines.length,
      enginesTypes: engines.map(c => c.type)
    });

    const columnWidth = calculateColumnWidth(engines.length);

    return engines.map((engineItem, index) => {
      const componentType = mapContractTypeToComponentType(engineItem.type);
      const labels = COLUMN_LABELS[componentType] || COLUMN_LABELS.regex;
      const color = EXTRACTOR_COLORS[componentType] || EXTRACTOR_COLORS.regex;
      const enabled = engineItem.enabled !== false;

      // Map to enabledMethods prop (for backward compatibility - used for testing)
      const enabledMethodKey = componentType === 'deterministic' ? 'deterministic' : componentType;
      const isEnabledInProps = enabledMethods[enabledMethodKey as keyof typeof enabledMethods] ?? false;

      // Get available methods for this column
      const availableMethods = getAvailableMethods();
      const isDropdownOpen = openDropdownAfter === engineItem.type;

      return (
        <TesterGridHeaderColumn
          key={engineItem.type}
          type={componentType}
          contractType={engineItem.type}
          mainLabel={labels.main}
          techLabel={labels.tech}
          tooltip={labels.tooltip}
          backgroundColor={color}
          enabled={enabled} // ✅ CRITICAL: Use engine.enabled directly from DataContract, not enabledMethods
          activeEditor={activeEditor}
          onToggleMethod={() => {
            // ✅ CRITICAL: Update engine.enabled in DataContract and save
            if (onContractChange && contract) {
              const updatedEngines = contract.engines.map(engine => {
                if (engine.type === engineItem.type) {
                  return { ...engine, enabled: !enabled };
                }
                return engine;
              });

              const updatedContract: DataContract = {
                ...contract,
                engines: updatedEngines,
              };

              onContractChange(updatedContract);
            }

            // ✅ Also toggle enabledMethods (per UI testing compatibility)
            toggleMethod(enabledMethodKey as keyof typeof enabledMethods);
          }}
          onToggleEditor={openEditor ? (type) => openEditor(type) : toggleEditor}
          showPostProcess={componentType === 'deterministic'}
          onAddContract={availableMethods.length > 0 && onContractChange ? () => {
            // Toggle dropdown for this column
            setOpenDropdownAfter(isDropdownOpen ? null : engineItem.type);
          } : undefined}
          availableMethods={availableMethods}
          isDropdownOpen={isDropdownOpen}
          onSelectMethod={onContractChange ? (selectedMethod) => {
            handleAddContractAfter(engineItem.type)(selectedMethod);
            setOpenDropdownAfter(null);
          } : undefined}
          columnWidth={columnWidth}
          onRemoveContract={onContractChange && engines.length > 1 ? () => handleRemoveContract(engineItem.type) : undefined}
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
        {/* Render dynamic columns based on engines array */}
        {engines && engines.length > 0 ? (
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
