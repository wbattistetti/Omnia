import React from 'react';
import { useDDTManager } from '../../../../context/DDTManagerContext';
import { ReviewItem } from './types';

type Props = {
    item: ReviewItem;
    onSave?: () => void;
};

export default function MessageReviewMessage({ item, onSave }: Props) {
    const { updateTranslation } = useDDTManager();
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(item.text);

    React.useEffect(() => {
        setDraft(item.text);
    }, [item.text]);

    const handleSave = () => {
        if (item.textKey) {
            try {
                updateTranslation(item.textKey, draft);
                setEditing(false);
                onSave?.();
            } catch (err) {
                console.error('Failed to save translation:', err);
            }
        }
    };

    const handleCancel = () => {
        setDraft(item.text);
        setEditing(false);
    };

    if (editing && item.textKey) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                            handleSave();
                        }
                        if (e.key === 'Escape') {
                            handleCancel();
                        }
                    }}
                    style={{
                        width: '100%',
                        background: '#0f172a',
                        color: '#e5e7eb',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '8px 10px',
                        minHeight: '60px',
                        fontFamily: 'inherit',
                        fontSize: 14,
                        resize: 'vertical',
                        wordWrap: 'break-word',
                    }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleCancel}
                        style={{
                            background: 'transparent',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: 13,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: 13,
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            title={item.textKey ? 'Click to edit' : undefined}
            onClick={() => {
                if (item.textKey) {
                    setEditing(true);
                }
            }}
            style={{
                cursor: item.textKey ? 'pointer' : 'default',
                padding: '10px',
                borderRadius: 6,
                background: item.textKey ? 'transparent' : '#f3f4f6',
                minHeight: '40px',
                wordBreak: 'break-word',
                fontSize: 14,
                lineHeight: '1.5',
                transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
                if (item.textKey) {
                    e.currentTarget.style.background = '#f9fafb';
                }
            }}
            onMouseLeave={(e) => {
                if (item.textKey) {
                    e.currentTarget.style.background = 'transparent';
                }
            }}
        >
            {item.text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No text</span>}
        </div>
    );
}

