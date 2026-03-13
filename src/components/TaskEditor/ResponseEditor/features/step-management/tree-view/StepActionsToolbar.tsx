import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { AddStepMenu } from './AddStepMenu';
import { ToolbarPosition } from './hooks/useStepFasciaHover';

interface StepActionsToolbarProps {
  stepKey: string;
  isRoot: boolean;
  isMandatory: boolean;
  onAddStep?: (stepKey: string) => void;
  onDeleteStep?: () => void;
  onDisableStep?: () => void;
  availableSteps: string[];
  position: ToolbarPosition | null;
}

/**
 * Toolbar overlay con azioni contestuali
 */
export function StepActionsToolbar({
  stepKey,
  isRoot,
  isMandatory,
  onAddStep,
  onDeleteStep,
  onDisableStep,
  availableSteps,
  position
}: StepActionsToolbarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!position) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          display: 'flex',
          gap: '4px',
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 10000
        }}
      >
        {/* Root: mostra "Aggiungi step" */}
        {isRoot && onAddStep && (
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            <Plus size={14} />
            <span>Aggiungi step</span>
          </button>
        )}

        {/* Altri step: mostra Delete e Disable */}
        {!isRoot && !isMandatory && (
          <>
            {onDeleteStep && (
              <button
                onClick={onDeleteStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Elimina step"
              >
                <Trash2 size={16} />
              </button>
            )}
            {onDisableStep && (
              <button
                onClick={onDisableStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  background: '#6b7280',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Disabilita step"
              >
                <X size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Menu aggiungi step */}
      {showAddMenu && isRoot && position && (
        <AddStepMenu
          availableSteps={availableSteps}
          onSelectStep={(stepKey) => {
            onAddStep?.(stepKey);
            setShowAddMenu(false);
          }}
          position={{
            top: position.top + 40,
            left: position.left
          }}
          onClose={() => setShowAddMenu(false)}
        />
      )}
    </>
  );
}
