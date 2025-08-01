import React from 'react';

interface DeleteConfirmationProps {
  onDelete: () => void;
  onCancel: () => void;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({ onDelete, onCancel }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
    padding: 12,
    background: '#181028',
    border: '1px solid #a21caf',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(80,0,80,0.08)'
  }}>
    <button
      style={{
        color: '#fff',
        background: '#ef4444',
        border: 'none',
        borderRadius: 4,
        padding: '10px 0',
        fontWeight: 700,
        fontSize: 16,
        cursor: 'pointer',
        marginBottom: 10,
        width: 140
      }}
      onClick={onDelete}
    >Elimina</button>
    <button
      style={{
        color: '#a21caf',
        background: 'none',
        border: '1px solid #a21caf',
        borderRadius: 4,
        padding: '10px 0',
        fontWeight: 700,
        fontSize: 16,
        cursor: 'pointer',
        width: 140
      }}
      onClick={onCancel}
    >Annulla</button>
  </div>
);

export default DeleteConfirmation; 