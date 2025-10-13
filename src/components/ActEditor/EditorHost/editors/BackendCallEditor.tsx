import React from 'react';
import type { EditorProps } from '../../EditorHost/types';

export default function BackendCallEditor({ act }: EditorProps) {
  return (
    <div className="h-full p-4 bg-white">
      <div className="font-medium mb-2">Backend Call</div>
      <div className="text-sm text-slate-600">Configure endpoint, payload mapping, and error handling here.</div>
      <div className="text-xs text-slate-500 mt-2">Act: {act.type}</div>
    </div>
  );
}


