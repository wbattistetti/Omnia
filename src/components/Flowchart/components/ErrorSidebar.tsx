// Error Sidebar Component
// Displays list of compilation errors with click-to-select-node functionality

import React from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ErrorSidebarProps {
  errors: CompilationError[];
  onErrorClick: (error: CompilationError) => void;
  onClose?: () => void;
}

export function ErrorSidebar({ errors, onErrorClick, onClose }: ErrorSidebarProps) {
  if (errors.length === 0) {
    return null;
  }

  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const blockingErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-bold text-lg">Compilation Errors</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close error sidebar"
          >
            ×
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-1">
            {criticalErrors.length > 0 && (
              <span className="text-red-900 font-semibold">
                {criticalErrors.length} Critical
              </span>
            )}
            {blockingErrors.length > 0 && (
              <span className="text-red-600 font-semibold">
                {blockingErrors.length} Error{blockingErrors.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-yellow-600 font-semibold">
                {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Total: {errors.length} issue{errors.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Error List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {errors.map((error, idx) => {
            const isCritical = error.severity === 'critical';
            const isError = error.severity === 'error';
            const isWarning = error.severity === 'warning';

            return (
              <div
                key={idx}
                onClick={() => onErrorClick(error)}
                className={`p-3 rounded border-l-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  isCritical
                    ? 'border-red-900 bg-red-50'
                    : isError
                    ? 'border-red-500 bg-red-50'
                    : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCritical || isError ? (
                      <AlertCircle
                        className={`h-4 w-4 ${
                          isCritical ? 'text-red-900' : 'text-red-500'
                        }`}
                      />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1">
                      {error.nodeId ? (
                        <span>Node: {error.nodeId.substring(0, 8)}...</span>
                      ) : error.taskId ? (
                        <span>Task: {error.taskId.substring(0, 8)}...</span>
                      ) : (
                        <span>System</span>
                      )}
                    </div>
                    <div
                      className={`text-xs ${
                        isCritical
                          ? 'text-red-800'
                          : isError
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
