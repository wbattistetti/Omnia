import React from 'react';
import { TestResult } from '../../types/types';

export function ExplanationPanel({ result }: { result?: TestResult }){
  const ex = result?.explain || { keywords: [], nearestExample: '' };
  const method = result?.method;

  // ✅ Badge per mostrare il metodo usato
  const getMethodBadge = () => {
    if (!method) return null;

    if (method === 'fast-path') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 border border-yellow-300" title="Using fast path (Jaccard similarity) - lower accuracy">
          ⚡ Fast Path
        </span>
      );
    } else if (method === 'embeddings') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 border border-green-300" title="Using embeddings model - higher accuracy">
          🧠 Embeddings
        </span>
      );
    } else if (method === 'hybrid') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 border border-blue-300" title="Using hybrid approach (fast path + embeddings)">
          🔄 Hybrid
        </span>
      );
    }
    return null;
  };

  // ✅ Mostra score breakdown se hybrid
  const showScoreBreakdown = method === 'hybrid' && result?.baselineScore !== undefined && result?.embeddingScore !== undefined;

  return (
    <div className="text-sm mt-2">
      <div className="font-medium mb-1 flex items-center gap-2">
        <span>Explain</span>
        {getMethodBadge()}
      </div>

      {/* ✅ Score breakdown per hybrid */}
      {showScoreBreakdown && (
        <div className="text-xs mb-2 p-2 bg-blue-50 rounded border border-blue-200">
          <div className="font-medium text-blue-900 mb-1">Score breakdown:</div>
          <div className="text-blue-700">Fast path: {(result.baselineScore! * 100).toFixed(1)}%</div>
          <div className="text-blue-700">Embeddings: {(result.embeddingScore! * 100).toFixed(1)}%</div>
          <div className="text-blue-900 font-medium mt-1">Final: {(result.score * 100).toFixed(1)}%</div>
        </div>
      )}

      {/* ⚠️ Warning se usa solo fast path */}
      {method === 'fast-path' && result && result.score >= 0.25 && result.score < 0.7 && (
        <div className="text-xs mb-2 p-2 bg-yellow-50 rounded border border-yellow-200 text-yellow-800">
          💡 Tip: Train embeddings model for better accuracy on medium-confidence cases
        </div>
      )}

      <div className="text-xs text-gray-600">Keywords: {ex.keywords.join(', ') || 'none'}</div>
      {ex.pattern && <div className="text-xs text-gray-600">Pattern: {ex.pattern}</div>}
      {ex.nearestExample && <div className="text-xs text-gray-600">Nearest: {ex.nearestExample}</div>}
    </div>
  );
}


