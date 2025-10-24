import React, { useRef, useEffect } from 'react';
import { useIntellisense } from "../../context/IntellisenseContext";
import { IntellisenseMenu } from './IntellisenseMenu';
import { IntellisenseItem } from '../../types/intellisense';

interface IntellisenseStandaloneProps {
    position: { x: number; y: number };
    referenceElement: HTMLElement | null;
    extraItems: IntellisenseItem[];
    allowedKinds?: Array<'condition' | 'intent'>;
    onSelect: (item: IntellisenseItem) => void;
    onClose: () => void;
}

export const IntellisenseStandalone: React.FC<IntellisenseStandaloneProps> = ({
    position,
    referenceElement,
    extraItems,
    allowedKinds,
    onSelect,
    onClose
}) => {
    const { state, actions } = useIntellisense();
    const inputRef = useRef<HTMLInputElement>(null);

    // Forza il focus sulla textbox
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            console.log("🎯 [IntellisenseStandalone] Focus forced on input");
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("🎯 [IntellisenseStandalone] Input change:", e.target.value);
        actions.setQuery(e.target.value);
    };

    // ✅ Aggiungi un handler per prevenire la propagazione del click
    const handleWrapperClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // ✅ Impedisce al click di propagarsi all'esterno
        console.log("🎯 [IntellisenseStandalone] Wrapper click - preventing close");
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: position.y,
                left: position.x,
                width: '320px',
                zIndex: 99999,
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(30,41,59,0.10)',
                padding: '12px'
            }}
            onClick={handleWrapperClick} // ✅ Previene la chiusura
            onMouseDown={handleWrapperClick} // ✅ Previene anche onMouseDown
        >
            {/* Textbox dedicata per edge */}
            <input
                ref={inputRef}
                type="text"
                value={state.query}
                onChange={handleInputChange}
                placeholder="Cerca condizioni o intenti..."
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #3b82f6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginBottom: '12px',
                    outline: 'none',
                    boxSizing: 'border-box'
                }}
            />

            {/* IntellisenseMenu (solo lista, mode=inline) */}
            <IntellisenseMenu
                isOpen={true}
                query={state.query}
                position={position}
                referenceElement={referenceElement}
                onSelect={onSelect}
                onClose={onClose}
                extraItems={extraItems}
                allowedKinds={allowedKinds}
                mode="inline" // ✅ Solo lista, no textbox
            />
        </div>
    );
};
