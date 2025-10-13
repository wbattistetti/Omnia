import React, { useState } from 'react';
import type { EditorProps } from '../../EditorHost/types';

export default function TextMessageEditor({ act }: EditorProps) {
  const [text, setText] = useState('');
  return (
    <div className="h-full p-4 bg-white">
      <div className="text-sm text-slate-700 mb-2">Message text</div>
      <textarea className="w-full min-h-[220px] rounded-xl border p-3 text-sm" value={text} onChange={e=>setText(e.target.value)} />
      <div className="text-xs text-slate-500 mt-2">Act: {act.type}</div>
    </div>
  );
}


