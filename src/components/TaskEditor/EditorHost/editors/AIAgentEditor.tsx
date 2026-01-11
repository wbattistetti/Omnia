import React from 'react';
import type { EditorProps } from '../types';

export default function AIAgentEditor({ task, onClose, onToolbarUpdate, hideHeader }: EditorProps) {
  return (
    <div className="h-full w-full bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center">
        <h2 className="text-xl font-bold mb-2">AI Agent Editor</h2>
        <p className="text-sm text-gray-400">Editor for AI Agent tasks (coming soon)</p>
        <p className="text-xs text-gray-500 mt-2">Task ID: {task?.id}</p>
      </div>
    </div>
  );
}
