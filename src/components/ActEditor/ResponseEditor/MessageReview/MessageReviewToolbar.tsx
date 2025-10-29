import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
    onExpandAll: () => void;
    onCollapseAll: () => void;
};

export default function MessageReviewToolbar({ onExpandAll, onCollapseAll }: Props) {
    return (
        <div style={{
            display: 'flex',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid #e2e8f0',
            background: '#fafafa'
        }}>
            <button
                onClick={onExpandAll}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                }}
                title="Expand all accordions"
            >
                <ChevronDown size={14} />
                Espandi tutto
            </button>
            <button
                onClick={onCollapseAll}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                }}
                title="Collapse all accordions"
            >
                <ChevronUp size={14} />
                Collassa tutto
            </button>
        </div>
    );
}

