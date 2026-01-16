import React, { useMemo } from 'react';
import TesterGridInput from './TesterGridInput';
import TesterGridActionsColumn from './TesterGridActionsColumn';
import TesterGridHeaderColumn from './TesterGridHeaderColumn';
import AddContractDropdown from './AddContractDropdown';
import type { NLPContract } from '../../../../DialogueDataEngine/contracts/contractLoader';

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
  contract?: NLPContract | null; // ✅ STEP 5: Contract prop
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
  showDeterministic: boolean;
  showNER: boolean;
  showEmbeddings: boolean;
  headerRowRef: React.RefObject<HTMLTableRowElement>;
  onContractChange?: (contract: NLPContract | null) => void; // ✅ STEP 9: Callback per modificare contract
}

/**
 * Header component for the tester grid
 */
export default function TesterGridHeader({
  contract, // ✅ STEP 5: Contract prop
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
  showDeterministic,
  showNER,
  showEmbeddings,
  headerRowRef,
  onContractChange, // ✅ STEP 9: Destructure callback
}: TesterGridHeaderProps) {
  // ✅ STEP 9: State per gestire quale colonna ha il dropdown "+" aperto
  const [openDropdownAfter, setOpenDropdownAfter] = React.useState<string | null>(null);
  // ✅ STEP 5: Read escalationOrder from contract (simplified, no legacy fallback)
  // ✅ FIX: Dipende dalla stringa join invece che dall'oggetto per forzare il rilevamento del cambiamento
  const escalationOrder = useMemo<Array<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'> | null>(() => {
    if (contract?.methods && contract.escalationOrder) {
      // ✅ FIX: Crea un nuovo array per forzare il rilevamento del cambiamento
      return [...contract.escalationOrder];
    }
    return null; // No contract or no escalationOrder → will show "Add contract" button
  }, [contract?.escalationOrder?.join(',')]); // ✅ FIX: Dipende dalla stringa join

  // ✅ STEP 6: Map contract method type to component type
  const mapMethodTypeToComponentType = (method: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'): 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings' => {
    if (method === 'rules') return 'deterministic';
    return method;
  };

  // ✅ STEP 6: Check if method is enabled in contract
  const isMethodEnabled = (method: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'): boolean => {
    if (!contract?.methods) return false;
    switch (method) {
      case 'regex':
        return contract.methods.regex?.enabled ?? false;
      case 'rules':
        return contract.methods.rules?.enabled ?? false;
      case 'ner':
        return contract.methods.ner?.enabled ?? false;
      case 'llm':
        return contract.methods.llm?.enabled ?? false;
      case 'embeddings':
        return contract.methods.embeddings?.enabled ?? false;
      default:
        return false;
    }
  };

  // ✅ STEP 9: Get available methods (excluding already added ones)
  const getAvailableMethods = (): Array<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'> => {
    const allMethods: Array<'regex' | 'rules' | 'ner' | 'llm' | 'embeddings'> = ['regex', 'rules', 'ner', 'llm', 'embeddings'];
    if (!escalationOrder) return allMethods;
    return allMethods.filter(m => !escalationOrder.includes(m));
  };

  // ✅ STEP 9: Handle adding contract after a specific column
  const handleAddContractAfter = (insertAfterMethod: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings') => {
    return (newMethod: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings') => {
      console.log('[TesterGridHeader][handleAddContractAfter] Adding contract', {
        insertAfterMethod,
        newMethod,
        hasContract: !!contract,
        hasOnContractChange: !!onContractChange,
        currentEscalationOrder: escalationOrder,
      });

      if (!contract || !onContractChange) {
        console.warn('[TesterGridHeader][handleAddContractAfter] Missing contract or callback', {
          hasContract: !!contract,
          hasOnContractChange: !!onContractChange,
        });
        return;
      }

      const currentOrder = escalationOrder || [];
      const insertIndex = currentOrder.indexOf(insertAfterMethod) + 1;

      // Create new escalation order
      const newEscalationOrder = [
        ...currentOrder.slice(0, insertIndex),
        newMethod,
        ...currentOrder.slice(insertIndex),
      ];

      console.log('[TesterGridHeader][handleAddContractAfter] New escalation order', {
        insertIndex,
        newEscalationOrder,
      });

      // Initialize new method in contract.methods if not exists
      const updatedMethods = { ...contract.methods };
      if (!updatedMethods[newMethod]) {
        updatedMethods[newMethod] = { enabled: true } as any;
      }

      // ✅ FIX: Crea un nuovo oggetto contract per forzare il cambio di riferimento
      const updatedContract: NLPContract = {
        ...contract,
        methods: { ...updatedMethods },
        escalationOrder: newEscalationOrder,
      };

      console.log('[TesterGridHeader][handleAddContractAfter] Calling onContractChange', {
        escalationOrder: updatedContract.escalationOrder,
        methods: Object.keys(updatedContract.methods || {}),
      });

      // ✅ FIX: Chiudi il dropdown prima di chiamare onContractChange
      setOpenDropdownAfter(null);

      onContractChange(updatedContract);
    };
  };

  // ✅ STEP 9: Handle adding first contract (when no contract exists)
  const handleAddFirstContract = (method: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings') => {
    if (!onContractChange) {
      console.warn('[TesterGridHeader][handleAddFirstContract] No onContractChange callback');
      return;
    }

    console.log('[TesterGridHeader][handleAddFirstContract] Adding first contract', {
      method,
      hasExistingContract: !!contract,
    });

    // ✅ FIX: Crea un nuovo contract con spread operator per forzare nuovo riferimento
    const newContract: NLPContract = {
      templateName: contract?.templateName || '',
      templateId: contract?.templateId || '',
      subDataMapping: contract?.subDataMapping ? { ...contract.subDataMapping } : {},
      methods: {
        [method]: { enabled: true } as any,
      },
      escalationOrder: [method],
    };

    console.log('[TesterGridHeader][handleAddFirstContract] Created contract', {
      escalationOrder: newContract.escalationOrder,
      methods: Object.keys(newContract.methods || {}),
    });

    onContractChange(newContract);
  };

  // ✅ NUOVO: Handle removing a contract
  const handleRemoveContract = (methodToRemove: 'regex' | 'rules' | 'ner' | 'llm' | 'embeddings') => {
    if (!contract || !onContractChange) return;

    const newEscalationOrder = escalationOrder?.filter(m => m !== methodToRemove) || [];

    if (newEscalationOrder.length === 0) {
      // Se non ci sono più contratti, rimuovi tutto
      onContractChange(null);
      return;
    }

    // Rimuovi il metodo dal contract
    const newMethods = { ...contract.methods };
    delete newMethods[methodToRemove];

    const newContract: NLPContract = {
      ...contract,
      escalationOrder: newEscalationOrder,
      methods: newMethods,
    };

    onContractChange(newContract);
  };

  // ✅ FIX: Calculate column width for dynamic columns
  // Assume: phraseColumnWidth (280px) + Actions (80px) + Buttons (80px) = 440px fixed
  // Remaining width is distributed among dynamic columns
  const calculateColumnWidth = (totalColumns: number): number => {
    if (totalColumns === 0) return 200; // Default width if no columns
    // Estimate: 100% - 440px fixed = available width
    // Distribute evenly among dynamic columns (min 220px per column per contenere "Espressione (Regex)" + icone)
    const minColumnWidth = 220; // ✅ AUMENTATO da 150 a 220 per evitare tagli
    const estimatedTotalWidth = 1200; // Approximate table width
    const fixedWidth = 440; // phraseColumnWidth (280) + Actions (80) + Buttons (80)
    const availableWidth = estimatedTotalWidth - fixedWidth;
    const calculatedWidth = Math.max(minColumnWidth, Math.floor(availableWidth / totalColumns));
    return calculatedWidth;
  };

  // ✅ STEP 6: Render dynamic columns based on escalationOrder
  const renderDynamicColumns = () => {
    if (!escalationOrder || escalationOrder.length === 0) {
      // STEP 11: Show "Add contract" dropdown when no contract
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

    const columnWidth = calculateColumnWidth(escalationOrder.length);

    return escalationOrder.map((method, index) => {
      const componentType = mapMethodTypeToComponentType(method);
      const labels = COLUMN_LABELS[componentType] || COLUMN_LABELS.regex;
      const color = EXTRACTOR_COLORS[componentType] || EXTRACTOR_COLORS.regex;
      const enabled = isMethodEnabled(method);

      // Map to enabledMethods prop (for backward compatibility)
      const enabledMethodKey = componentType === 'deterministic' ? 'deterministic' : componentType;
      const isEnabledInProps = enabledMethods[enabledMethodKey as keyof typeof enabledMethods] ?? false;

      // ✅ STEP 9: Get available methods for this column
      const availableMethods = getAvailableMethods();
      const isDropdownOpen = openDropdownAfter === method;

      return (
        <TesterGridHeaderColumn
          key={method}
          type={componentType}
          mainLabel={labels.main}
          techLabel={labels.tech}
          tooltip={labels.tooltip}
          backgroundColor={color}
          enabled={isEnabledInProps}
          activeEditor={activeEditor}
          onToggleMethod={() => toggleMethod(enabledMethodKey as keyof typeof enabledMethods)}
          onToggleEditor={toggleEditor}
          showPostProcess={componentType === 'deterministic'}
          onAddContract={availableMethods.length > 0 && onContractChange ? () => {
            // ✅ STEP 9: Toggle dropdown for this column
            setOpenDropdownAfter(isDropdownOpen ? null : method);
          } : undefined}
          availableMethods={availableMethods}
          isDropdownOpen={isDropdownOpen}
          onSelectMethod={onContractChange ? (selectedMethod) => {
            handleAddContractAfter(method)(selectedMethod);
            setOpenDropdownAfter(null);
          } : undefined}
          columnWidth={columnWidth}
          onRemoveContract={onContractChange && escalationOrder.length > 1 ? () => handleRemoveContract(method) : undefined}
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
          position: 'sticky', // ✅ FIX: Cambiato da 'relative' a 'sticky'
          left: 0, // ✅ FIX: Fissa a sinistra
          zIndex: 1002, // ✅ CRITICAL: zIndex più alto per garantire che l'input sia sempre cliccabile
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
        {/* ✅ STEP 6: Render dynamic columns based on escalationOrder */}
        {escalationOrder ? (
          renderDynamicColumns()
        ) : (
          // ✅ STEP 11: Show "Add contract" dropdown when no contract
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
