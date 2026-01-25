/**
 * Contract Selector
 * Dynamic contract selection component - designer chooses which contracts to use
 * and can reorder them for custom escalation
 */

import React, { useState, useCallback } from 'react';
import { Plus, ChevronUp, ChevronDown, X, Sparkles } from 'lucide-react';
import type { DataContract, ContractType } from '../../../../components/DialogueDataEngine/contracts/contractLoader';

export type ContractMethod = ContractType;

export interface ContractMethodInfo {
  id: ContractMethod;
  label: string;
  shortLabel: string;
  color: string;
  icon?: React.ReactNode;
}

const ALL_CONTRACTS: ContractMethodInfo[] = [
  { id: 'regex', label: 'Espressione (Regex)', shortLabel: 'Regex', color: '#93c5fd' },
  { id: 'rules', label: 'Logica (Extractor)', shortLabel: 'Logica', color: '#e5e7eb' },
  { id: 'ner', label: 'AI Rapida (NER)', shortLabel: 'NER', color: '#fef3c7' },
  { id: 'llm', label: 'AI Completa (LLM)', shortLabel: 'LLM', color: '#fed7aa' },
  { id: 'embeddings', label: 'Embeddings', shortLabel: 'Embeddings', color: '#e0e7ff' },
];

const SUGGESTED_ORDER: ContractMethod[] = ['regex', 'rules', 'ner', 'llm', 'embeddings'];

interface ContractSelectorProps {
  contract: DataContract | null;
  onContractChange: (contract: DataContract) => void;
  kind?: string; // 'intent' or other data types
}

export default function ContractSelector({
  contract,
  onContractChange,
  kind,
}: ContractSelectorProps) {
  // Get enabled contracts from contract.contracts array
  const enabledContracts = React.useMemo(() => {
    if (!contract?.contracts || !Array.isArray(contract.contracts)) return [];
    return contract.contracts.filter(c => c.enabled !== false);
  }, [contract?.contracts]);

  // Get enabled method types (for compatibility)
  const enabledMethods = React.useMemo(() => {
    return enabledContracts.map(c => c.type);
  }, [enabledContracts]);

  // Get available methods (not yet added)
  const availableMethods = React.useMemo(() => {
    return ALL_CONTRACTS.filter(
      contractInfo => !enabledMethods.includes(contractInfo.id)
    );
  }, [enabledMethods]);

  const [showAddMenu, setShowAddMenu] = useState(false);

  // Helper: Create default contract item
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

  // Add a contract method
  const handleAddContract = useCallback((method: ContractMethod) => {
    if (!contract) {
      // Create new contract if doesn't exist
      const newContract: DataContract = {
        templateName: '',
        templateId: '',
        subDataMapping: {},
        contracts: [createDefaultContract(method)],
      };
      onContractChange(newContract);
      setShowAddMenu(false);
      return;
    }

    // Check if contract already exists
    const existingContract = contract.contracts.find(c => c.type === method);
    if (existingContract) {
      // Re-enable if disabled
      const updatedContracts = contract.contracts.map(c =>
        c.type === method ? { ...c, enabled: true } : c
      );
      const updatedContract: DataContract = {
        ...contract,
        contracts: updatedContracts,
      };
      onContractChange(updatedContract);
    } else {
      // Add new contract
      const newContractItem = createDefaultContract(method);
      const updatedContract: DataContract = {
        ...contract,
        contracts: [...contract.contracts, newContractItem],
      };
      onContractChange(updatedContract);
    }
    setShowAddMenu(false);
  }, [contract, onContractChange]);

  // Remove a contract method (disable it)
  const handleRemoveContract = useCallback((method: ContractMethod) => {
    if (!contract) return;

    const updatedContracts = contract.contracts.map(c =>
      c.type === method ? { ...c, enabled: false } : c
    );

    const updatedContract: DataContract = {
      ...contract,
      contracts: updatedContracts,
    };

    onContractChange(updatedContract);
  }, [contract, onContractChange]);

  // Move contract up in escalation order (reorder contracts array)
  const handleMoveUp = useCallback((method: ContractMethod) => {
    if (!contract) return;

    const currentIndex = enabledContracts.findIndex(c => c.type === method);
    if (currentIndex <= 0) return;

    const newContracts = [...contract.contracts];
    // Find indices in full contracts array
    const fullIndex1 = contract.contracts.findIndex(c => c.type === enabledContracts[currentIndex - 1].type);
    const fullIndex2 = contract.contracts.findIndex(c => c.type === method);
    [newContracts[fullIndex1], newContracts[fullIndex2]] = [newContracts[fullIndex2], newContracts[fullIndex1]];

    const updatedContract: DataContract = {
      ...contract,
      contracts: newContracts,
    };

    onContractChange(updatedContract);
  }, [contract, enabledContracts, onContractChange]);

  // Move contract down in escalation order (reorder contracts array)
  const handleMoveDown = useCallback((method: ContractMethod) => {
    if (!contract) return;

    const currentIndex = enabledContracts.findIndex(c => c.type === method);
    if (currentIndex < 0 || currentIndex >= enabledContracts.length - 1) return;

    const newContracts = [...contract.contracts];
    // Find indices in full contracts array
    const fullIndex1 = contract.contracts.findIndex(c => c.type === method);
    const fullIndex2 = contract.contracts.findIndex(c => c.type === enabledContracts[currentIndex + 1].type);
    [newContracts[fullIndex1], newContracts[fullIndex2]] = [newContracts[fullIndex2], newContracts[fullIndex1]];

    const updatedContract: DataContract = {
      ...contract,
      contracts: newContracts,
    };

    onContractChange(updatedContract);
  }, [contract, enabledContracts, onContractChange]);

  // Check if order differs from suggested
  const isOrderDifferent = React.useMemo(() => {
    if (enabledMethods.length === 0) return false;
    const suggestedFiltered = SUGGESTED_ORDER.filter(m => enabledMethods.includes(m));
    return JSON.stringify(enabledMethods) !== JSON.stringify(suggestedFiltered);
  }, [enabledMethods]);

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!showAddMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.contract-selector-menu')) {
        setShowAddMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
          Contract Methods
        </label>

        {/* Add Contract Button */}
        <div className="contract-selector-menu" style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={availableMethods.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: availableMethods.length === 0 ? '#f3f4f6' : '#fff',
              color: availableMethods.length === 0 ? '#9ca3af' : '#374151',
              cursor: availableMethods.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Plus size={14} />
            Aggiungi contract
          </button>

          {/* Dropdown Menu */}
          {showAddMenu && availableMethods.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                minWidth: 200,
              }}
            >
              {availableMethods.map(method => (
                <button
                  key={method.id}
                  onClick={() => handleAddContract(method.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: method.color,
                    }}
                  />
                  {method.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contract List */}
      {enabledMethods.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: '#f9fafb',
            border: '1px dashed #d1d5db',
            borderRadius: 6,
            color: '#6b7280',
            fontSize: 13,
          }}
        >
          ⚠️ Aggiungi almeno un contract
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enabledMethods.map((methodId, index) => {
            const methodInfo = ALL_CONTRACTS.find(m => m.id === methodId);
            if (!methodInfo) return null;

            return (
              <div
                key={methodId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                }}
              >
                {/* Color indicator */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: methodInfo.color,
                    flexShrink: 0,
                  }}
                />

                {/* Method name */}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#374151' }}>
                  {methodInfo.label}
                </span>

                {/* Move buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleMoveUp(methodId)}
                    disabled={index === 0}
                    style={{
                      padding: 4,
                      border: 'none',
                      background: index === 0 ? '#f3f4f6' : 'transparent',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      color: index === 0 ? '#9ca3af' : '#374151',
                    }}
                    title="Sposta su"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMoveDown(methodId)}
                    disabled={index === enabledMethods.length - 1}
                    style={{
                      padding: 4,
                      border: 'none',
                      background: index === enabledMethods.length - 1 ? '#f3f4f6' : 'transparent',
                      cursor: index === enabledMethods.length - 1 ? 'not-allowed' : 'pointer',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      color: index === enabledMethods.length - 1 ? '#9ca3af' : '#374151',
                    }}
                    title="Sposta giù"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => handleRemoveContract(methodId)}
                    style={{
                      padding: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      color: '#ef4444',
                    }}
                    title="Rimuovi"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Escalation Order Display */}
          <div style={{ marginTop: 8, padding: 8, background: '#f9fafb', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: '#6b7280', fontWeight: 500 }}>Escalation:</span>
              <span style={{ color: '#374151' }}>
                {enabledMethods.map(m => {
                  const info = ALL_CONTRACTS.find(c => c.id === m);
                  return info?.shortLabel || m;
                }).join(' → ')}
              </span>
              {isOrderDifferent && (
                <span style={{ color: '#f59e0b', fontSize: 11, marginLeft: 8 }}>
                  💡 Suggerito: {SUGGESTED_ORDER.filter(m => enabledMethods.includes(m))
                    .map(m => {
                      const info = ALL_CONTRACTS.find(c => c.id === m);
                      return info?.shortLabel || m;
                    }).join(' → ')}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
