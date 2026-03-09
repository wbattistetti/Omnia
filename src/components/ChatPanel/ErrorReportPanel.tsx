// Error Report Panel Component
// Displays compilation errors with navigation to flowchart nodes

import React from 'react';
import { useCompilationErrors } from '@context/CompilationErrorsContext';
import { handleErrorFix } from '@utils/handleErrorFix';
import type { CompilationError } from '@components/FlowCompiler/types';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export interface ErrorReportPanelProps {
  onClose?: () => void;
}

export function ErrorReportPanel({ onClose }: ErrorReportPanelProps) {
  const { errors } = useCompilationErrors();

  const handleErrorClick = React.useCallback(async (error: CompilationError) => {
    try {
      await handleErrorFix(error);
    } catch (err) {
      console.error('[ErrorReportPanel] Error navigating to fix:', err);
    }
  }, []);

  if (errors.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="text-center text-gray-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm">No compilation errors</p>
          <p className="text-xs text-gray-400 mt-2">All checks passed</p>
        </div>
      </div>
    );
  }

  const blockingErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  return (
    <div className="w-full h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <h3 className="font-bold text-lg text-gray-900">Error Report</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close error report"
            title="Close error report"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-3 mb-1">
            {blockingErrors.length > 0 && (
              <span className="text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {blockingErrors.length} Error{blockingErrors.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-yellow-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Total: {errors.length} issue{errors.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Error List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {errors.map((error, idx) => {
            const isError = error.severity === 'error';
            const isWarning = error.severity === 'warning';

            // Get display label for error location
            const getLocationLabel = () => {
              if (error.nodeId) {
                return `Node: ${error.nodeId.substring(0, 8)}...`;
              }
              if (error.edgeId) {
                return `Edge: ${error.edgeId.substring(0, 8)}...`;
              }
              if (error.taskId) {
                return `Task: ${error.taskId.substring(0, 8)}...`;
              }
              return 'System';
            };

            return (
              <div
                key={`${error.taskId}-${idx}`}
                onClick={() => handleErrorClick(error)}
                className={`p-3 rounded border-l-4 cursor-pointer hover:bg-opacity-80 transition-all ${
                  isError
                    ? 'border-red-500 bg-red-50 hover:bg-red-100'
                    : 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                }`}
                title="Click to navigate to error location"
              >
                <div className="flex items-start gap-2">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isError ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1 text-gray-900">
                      {getLocationLabel()}
                    </div>
                    <div
                      className={`text-xs ${
                        isError
                          ? 'text-red-700'
                          : 'text-yellow-700'
                      }`}
                    >
                      {error.message}
                    </div>
                    {error.category && (
                      <div className="text-xs text-gray-500 mt-1">
                        Category: {error.category}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
