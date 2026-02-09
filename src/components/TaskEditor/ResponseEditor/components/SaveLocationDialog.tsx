// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';

interface SaveLocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToFactory: () => void;
  onSaveToProject: () => void;
  onCancel: () => void;
}

/**
 * Dialog component for choosing where to save a generalizable template
 *
 * Shows when shouldBeGeneral === true and user hasn't made a decision yet
 */
export function SaveLocationDialog({
  isOpen,
  onClose,
  onSaveToFactory,
  onSaveToProject,
  onCancel
}: SaveLocationDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <span>Where do you want to save this task?</span>
        </h2>

        <p className="text-sm text-gray-700 mb-4">
          This task has been recognized as potentially general.
          This means that the logic, messages, and rules that compose it do not depend on a specific context, but represent a universal concept.
        </p>

        <p className="text-sm text-gray-700 mb-6">
          If you choose to save it as a Factory Template:
        </p>

        <ul className="list-disc list-inside text-sm text-gray-700 mb-6 space-y-1 ml-4">
          <li>Generalized messages will be saved</li>
          <li>The template will become reusable in other projects</li>
          <li>It can be automatically suggested by the Wizard in the future</li>
        </ul>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              onSaveToFactory();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Save to Factory DB
          </button>
          <button
            onClick={() => {
              onSaveToProject();
              onClose();
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Save only to project
          </button>
          <button
            onClick={() => {
              onCancel();
              onClose();
            }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
