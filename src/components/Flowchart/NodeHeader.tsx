import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Trash2, Edit3, Check, X } from 'lucide-react';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { createPortal } from 'react-dom';

/**
 * Props per NodeHeader
 * @property title - titolo del nodo
 * @property onDelete - callback per eliminare il nodo
 * @property onToggleEdit - callback per attivare/disattivare la modalità editing
 * @property onTitleUpdate - callback per aggiornare il titolo
 * @property isEditing - true se il nodo è in modalità editing
 */
export interface NodeHeaderProps {
  title: string;
  onDelete: () => void;
  onToggleEdit: () => void;
  onTitleUpdate: (newTitle: string) => void;
  isEditing: boolean;
  onPlay?: () => void; // nuova prop opzionale
}

/**
 * Header del nodo: mostra titolo, azioni di editing e delete.
 */
export const NodeHeader: React.FC<NodeHeaderProps> = ({ 
  title, 
  onDelete, 
  onToggleEdit, 
  onTitleUpdate,
  isEditing,
  onPlay // aggiunto qui
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const [isHovered, setIsHovered] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });

  // Inizia editing titolo
  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setTempTitle(title);
    setTimeout(() => {
      if (titleInputRef.current) {
        const rect = titleInputRef.current.getBoundingClientRect();
        setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
        setShowIntellisense(true);
      }
    }, 0);
  };

  // Salva titolo
  const handleTitleSave = () => {
    onTitleUpdate(tempTitle.trim() || 'Untitled Node');
    setIsEditingTitle(false);
    setShowIntellisense(false);
  };

  // Annulla editing titolo
  const handleTitleCancel = () => {
    setTempTitle(title);
    setIsEditingTitle(false);
    setShowIntellisense(false);
  };

  // Gestione tasti Enter/Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  // Se perdi il focus, chiudi intellisense
  useEffect(() => {
    if (!isEditingTitle) setShowIntellisense(false);
  }, [isEditingTitle]);

  // Gestione selezione intellisense
  const handleIntellisenseSelect = (item: any) => {
    setTempTitle(item.name);
    setShowIntellisense(false);
    if (titleInputRef.current) titleInputRef.current.focus();
  };

  return (
    <div 
      className="flex items-center justify-between bg-gray-200 p-2 rounded-t-lg border-b border-slate-600"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Titolo + editing */}
      <div className="flex items-center min-w-0 flex-1" style={{ position: 'relative' }}>
        {isEditingTitle ? (
          <div className="flex items-center min-w-0 flex-1">
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="min-w-0 bg-slate-600 text-white text-[8px] px-1.5 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 border-2 border-purple-400 nodrag"
              style={{ width: '70%', maxWidth: '70%' }}
              onFocus={() => {
                if (titleInputRef.current) {
                  const rect = titleInputRef.current.getBoundingClientRect();
                  setIntellisensePosition({ x: rect.left, y: rect.bottom + 2 });
                  setShowIntellisense(true);
                }
              }}
            />
            <button
              onClick={handleTitleSave}
              className="ml-1 p-1 text-green-400 hover:text-green-300 transition-colors"
              title="Conferma"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={handleTitleCancel}
              className="ml-1 p-1 text-red-400 hover:text-red-300 transition-colors"
              title="Annulla"
            >
              <X className="w-3 h-3" />
            </button>
            {/* IntellisenseMenu come portale */}
            {showIntellisense &&
              createPortal(
                <div style={{
                  position: 'absolute',
                  left: intellisensePosition.x,
                  top: intellisensePosition.y,
                  zIndex: 9999,
                }}>
                  <IntellisenseMenu
                    isOpen={showIntellisense}
                    query={tempTitle}
                    position={{ x: 0, y: 0 }}
                    referenceElement={null}
                    onSelect={handleIntellisenseSelect}
                    onClose={() => setShowIntellisense(false)}
                    filterCategoryTypes={['tasks', 'macroTasks']}
                  />
                </div>,
                document.body
              )
            }
          </div>
        ) : (
          <h3
            className="text-black text-[8px] font-semibold cursor-pointer hover:text-purple-300 transition-colors truncate"
            onClick={handleTitleEdit}
            title="Modifica titolo"
            style={{ display: 'inline-block' }}
          >
            {title}
          </h3>
        )}
      </div>
      {/* Azioni a destra: SOLO se non in editing */}
      {!isEditingTitle && (
        <div
          className="flex items-center ml-2"
          style={{ minWidth: 40, height: 20, justifyContent: 'flex-end' }}
        >
          {isHovered && (
            <>
              <button 
                onClick={handleTitleEdit} 
                className="p-1 text-slate-400 hover:text-green-400 transition-colors"
                title="Modifica titolo"
              >
                <Edit3 className={`w-3 h-3 ${isEditing ? 'text-green-400' : ''}`} />
              </button>
              <button 
                onClick={onDelete} 
                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                title="Delete node"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={onPlay ? onPlay : () => {}}
                className="p-1 text-green-500 hover:text-green-700 transition-colors"
                title="Simula nodo"
                style={{ fontSize: '14px', marginLeft: '2px' }}
              >
                ▶️
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};