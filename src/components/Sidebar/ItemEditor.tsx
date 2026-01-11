import React, { useState, useEffect, useRef } from 'react';

interface ItemEditorProps {
  value?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  editing?: boolean;
  placeholder?: string;
  className?: string;
}

const ItemEditor: React.FC<ItemEditorProps> = ({
  value = '',
  onConfirm,
  onCancel,
  editing = true,
  placeholder = '',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isEditing, setIsEditing] = useState(editing);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleConfirm = () => {
    if (inputValue.trim() !== '') {
      onConfirm(inputValue.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setInputValue(value);
    setIsEditing(false);
    onCancel();
  };

  if (!isEditing) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <input
        ref={inputRef}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            (async () => {
              try {
                const mod = await import('../../nlp/taskInteractivity');
                const inferred = mod.classifyTaskInteractivity(inputValue);
                console.log('[Interactivity][enter]', { title: inputValue, inferred });
              } catch (err) {
                console.warn('[Interactivity][enter][error]', err);
              } finally {
                handleConfirm();
              }
            })();
          }
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder={placeholder}
        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={handleConfirm}
        className="text-green-600 hover:text-green-800 px-1"
        title="Conferma"
      >
        ✔
      </button>
      <button
        onClick={handleCancel}
        className="text-red-600 hover:text-red-800 px-1"
        title="Annulla"
      >
        ✖
      </button>
    </div>
  );
};

export default ItemEditor;