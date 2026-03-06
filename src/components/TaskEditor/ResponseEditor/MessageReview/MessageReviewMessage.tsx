import React, { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { ReviewItem } from '@responseEditor/MessageReview/types';
import { getTaskIconNode, getTaskMeta } from '@responseEditor/taskMeta';
import { ensureHexColor, tailwindToHex } from '@responseEditor/utils/color';
import ActionText from '@responseEditor/ActionText';
import { useFontContext } from '@context/FontContext';

type Props = {
    item: ReviewItem;
    onSave?: () => void;
    updateSelectedNode?: (updater: (node: any) => any) => void;
};

export default function MessageReviewMessage({ item, onSave, updateSelectedNode }: Props) {
    const { combinedClass } = useFontContext();
    const { addTranslation } = useProjectTranslations();
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

        // 🔍 DEBUG: Verifica se textKey esiste PRIMA del check
        console.log('[MessageReviewMessage] 🔍 DEBUG handleEditConfirm called', {
            hasTextKey: !!item.textKey,
            textKey: item.textKey,
            newText,
            nodeId: item.pathLabel,
            stepKey: item.stepKey,
            escIndex: item.escIndex,
            taskIndex: item.taskIndex,
            itemKeys: Object.keys(item),
            fullItem: item
        });

        // Always update translation in memory if textKey exists
        // This will be included in on-the-fly test deployments via window.__projectTranslationsContext
        // Database save happens only when user clicks explicit save button
        if (item.textKey) {
            // 🔍 DEBUG: Verifica quale GUID viene usato quando modifichi
            console.log('[MessageReviewMessage] 🔍 DEBUG Editing translation', {
                textKey: item.textKey,
                newText,
                nodeId: item.pathLabel,
                stepKey: item.stepKey,
                escIndex: item.escIndex,
                taskIndex: item.taskIndex,
                isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.textKey || '')
            });
            try {
                addTranslation(item.textKey, newText);
            } catch (err) {
                console.error('Failed to update translation:', err);
            }
        } else {
            // 🔍 DEBUG: textKey non esiste!
            console.warn('[MessageReviewMessage] ⚠️ DEBUG textKey is missing!', {
                item: item,
                itemKeys: Object.keys(item),
                hasTextKey: !!item.textKey,
                textKeyValue: item.textKey
            });
        }

        // ❌ RIMOSSO: Non salvare task.text - il task deve contenere solo GUID
        // Il modello corretto è:
        // - Il task contiene solo il GUID nei parameters (parameterId='text', value=GUID)
        // - La traduzione è in translations[textKey]
        // - Il runtime usa translations[textKey] per risolvere il testo
        // - task.text non deve esistere (è ridondante e crea confusione)
        //
        // La persistenza avviene tramite:
        // 1. addTranslation() aggiorna translations[textKey] in memoria
        // 2. saveAllTranslations() salva le traduzioni nel database
        // 3. Il task non viene modificato (contiene solo il GUID)

        setEditing(false);
        onSave?.();
    };

    const handleEditCancel = () => {
        setEditValue(item.text);
        setEditing(false);
    };

    const handleEdit = () => {
        // 🔍 DEBUG: Verifica se l'editing viene attivato
        console.log('[MessageReviewMessage] 🔍 DEBUG handleEdit called', {
            hasTextKey: !!item.textKey,
            textKey: item.textKey,
            currentText: item.text,
            taskId: item.taskId,
            nodeId: item.pathLabel,
            stepKey: item.stepKey,
            escIndex: item.escIndex,
            taskIndex: item.taskIndex,
            itemKeys: Object.keys(item)
        });

        if (item.textKey || item.taskId === 'sayMessage') {
            setEditValue(item.text);
            setEditing(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            // 🔍 DEBUG: Editing non attivato perché textKey non esiste
            console.warn('[MessageReviewMessage] ⚠️ DEBUG Editing not activated - textKey missing', {
                item: item,
                itemKeys: Object.keys(item),
                hasTextKey: !!item.textKey,
                textKeyValue: item.textKey,
                taskId: item.taskId
            });
        }
    };

    // Use centralized task icon system with task color (not step color)
    // ✅ NO FALLBACKS: item.taskId must exist, use 'sayMessage' only as explicit default for logging
    const taskId = item.taskId ?? 'sayMessage';
    // If no color in item, get it from catalog
    let taskColor = item.color ? ensureHexColor(item.color) : undefined;
    if (!taskColor) {
        const meta = getTaskMeta(taskId);
        if (meta.color) {
            taskColor = tailwindToHex(meta.color) || ensureHexColor(meta.color);
        }
    }
    const iconNode = getTaskIconNode(taskId, taskColor);

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
                if (!editing && (item.textKey || item.taskId === 'sayMessage')) {
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
                {editing && (item.textKey || item.taskId === 'sayMessage') ? (
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
                        title={(item.textKey || item.taskId === 'sayMessage') ? 'Click to edit' : undefined}
                        onClick={handleEdit}
                        className={combinedClass}
                        style={{
                            cursor: (item.textKey || item.taskId === 'sayMessage') ? 'pointer' : 'default',
                            flex: 1,
                            wordBreak: 'break-word',
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

