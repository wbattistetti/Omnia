import React from 'react';

interface DeleteConfirmationProps {
  onConfirm: () => void;
  triggerClass?: string;
  icon?: React.ReactNode;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({ onConfirm, triggerClass = '', icon }) => {
  return (
    <button
      className={triggerClass}
      onClick={onConfirm}
      title="Elimina"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      {icon || '🗑'}
    </button>
  );
};

export default DeleteConfirmation;