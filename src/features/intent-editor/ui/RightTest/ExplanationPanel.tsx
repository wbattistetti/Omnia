import React from 'react';

export function ExplanationPanel({ ex }: { ex: { keywords: string[]; pattern?: string; nearestExample?: string } }){
  return (
    <div className="text-sm mt-2">
      <div className="font-medium mb-1">Explain</div>
      <div className="text-xs text-gray-600">Keywords: {ex.keywords.join(', ')}</div>
      {ex.pattern && <div className="text-xs text-gray-600">Pattern: {ex.pattern}</div>}
      {ex.nearestExample && <div className="text-xs text-gray-600">Nearest: {ex.nearestExample}</div>}
    </div>
  );
}


