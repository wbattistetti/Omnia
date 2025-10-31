import React, { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { ReviewItem } from './types';
import { getActionIconNode, getActionMeta } from '../actionMeta';
import { ensureHexColor, tailwindToHex } from '../utils/color';
import ActionText from '../ActionText';

type Props = {
    item: ReviewItem;
    onSave?: () => void;
    updateSelectedNode?: (updater: (node: any) => any) => void;
};

export default function MessageReviewMessage({ item, onSave, updateSelectedNode }: Props) {
    const { updateTranslation } = useDDTManager();
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(item.text);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync editValue when text prop changes and we're not editing
    React.useEffect(() => {
        if (!editing) {
            setEditValue(item.text);
        }
    }, [item.text, editing]);

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleEditConfirm();
        }
        if (e.key === 'Escape') {
            handleEditCancel();
        }
    };

    const handleEditConfirm = () => {
        const newText = editValue.trim();

        // Always update translation if textKey exists
        if (item.textKey) {
            try {
                updateTranslation(item.textKey, newText);
            } catch (err) {
                console.error('Failed to save translation:', err);
            }
        }

        // Always update the node to persist the edited text
        // This ensures the text is saved even when switching steps or refreshing
        if (updateSelectedNode && item.stepKey && (item.escIndex !== null && item.escIndex !== undefined) && (item.actionIndex !== null && item.actionIndex !== undefined)) {
            updateSelectedNode((node: any) => {
                const steps = node?.steps || {};
                let stepData = steps[item.stepKey];

                if (!stepData) return node;

                // Handle array format: steps[stepKey] is an array of escalations
                if (Array.isArray(stepData)) {
                    const esc = stepData[item.escIndex!];
                    if (esc && Array.isArray(esc.actions) && esc.actions[item.actionIndex!]) {
                        const action = esc.actions[item.actionIndex!];
                        // Update the action text, preserving textKey and other properties
                        esc.actions[item.actionIndex!] = {
                            ...action,
                            text: newText.length > 0 ? newText : undefined,
                        };
                        return node;
                    }
                }
                // Handle object format: steps[stepKey].escalations is an array
                else if (stepData?.escalations && Array.isArray(stepData.escalations)) {
                    const esc = stepData.escalations[item.escIndex!];
                    if (esc && Array.isArray(esc.actions) && esc.actions[item.actionIndex!]) {
                        const action = esc.actions[item.actionIndex!];
                        // Update the action text, preserving textKey and other properties
                        esc.actions[item.actionIndex!] = {
                            ...action,
                            text: newText.length > 0 ? newText : undefined,
                        };
                        return node;
                    }
                }

                return node;
            });
        }

        setEditing(false);
        onSave?.();
    };

    const handleEditCancel = () => {
        setEditValue(item.text);
        setEditing(false);
    };

    const handleEdit = () => {
        if (item.textKey || item.actionId === 'sayMessage' || item.actionId === 'askQuestion') {
            setEditValue(item.text);
            setEditing(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    // Use centralized action icon system with action color (not step color)
    const actionId = item.actionId || 'sayMessage';
    // If no color in item, get it from catalog
    let actionColor = item.color ? ensureHexColor(item.color) : undefined;
    if (!actionColor) {
        const meta = getActionMeta(actionId);
        if (meta.color) {
            actionColor = tailwindToHex(meta.color) || ensureHexColor(meta.color);
        }
    }
    const iconNode = getActionIconNode(actionId, actionColor);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 4,
                transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
                if (!editing && (item.textKey || item.actionId === 'sayMessage' || item.actionId === 'askQuestion')) {
                    e.currentTarget.style.background = '#f9fafb';
                }
            }}
            onMouseLeave={(e) => {
                if (!editing) {
                    e.currentTarget.style.background = 'transparent';
                }
            }}
        >
            {iconNode && (
                <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    marginTop: editing ? 0 : 2
                }}>
                    {iconNode}
                </span>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {editing && (item.textKey || item.actionId === 'sayMessage' || item.actionId === 'askQuestion') ? (
                    <>
                        <ActionText
                            text={item.text}
                            editing={editing}
                            inputRef={inputRef}
                            editValue={editValue}
                            onChange={setEditValue}
                            onKeyDown={handleEditKeyDown}
                        />
                        <button
                            onClick={handleEditConfirm}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#22c55e',
                                cursor: 'pointer',
                                marginRight: 6,
                                fontSize: 18,
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                            tabIndex={-1}
                            title="Conferma modifica"
                            aria-label="Conferma modifica"
                        >
                            <Check size={18} />
                        </button>
                        <button
                            onClick={handleEditCancel}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: 18,
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                            tabIndex={-1}
                            title="Annulla modifica"
                            aria-label="Annulla modifica"
                        >
                            <X size={18} />
                        </button>
                    </>
                ) : (
                    <div
                        title={(item.textKey || item.actionId === 'sayMessage' || item.actionId === 'askQuestion') ? 'Click to edit' : undefined}
                        onClick={handleEdit}
                        style={{
                            cursor: (item.textKey || item.actionId === 'sayMessage' || item.actionId === 'askQuestion') ? 'pointer' : 'default',
                            flex: 1,
                            wordBreak: 'break-word',
                            fontSize: 14,
                            lineHeight: '1.5',
                            minHeight: '40px',
                        }}
                    >
                        {item.text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No text</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

