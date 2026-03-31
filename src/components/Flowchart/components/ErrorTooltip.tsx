// Error Tooltip Component
// Structured tooltip for compilation errors with header, message, and Fix button

import React from 'react';
import type { CompilationError } from '../../FlowCompiler/types';
import { AlertCircle, AlertTriangle, Wrench, X } from 'lucide-react';
import { normalizeSeverity } from '../../../utils/severityUtils';

interface ErrorTooltipProps {
  errors: CompilationError[];
  onFix?: (error: CompilationError) => void;
  onClose?: () => void; // ✅ NEW: Close handler
}

/** Italian copy for TaskNotFound in row/edge error mini-cards (tests import this). */
export const ERROR_TOOLTIP_TASK_NOT_FOUND_COPY = {
  title: 'Task non progettato',
  body: 'Il comportamento di questo task non è definito.',
} as const;

function isTaskNotFoundCategory(category?: string): boolean {
  const c = (category ?? '').trim();
  return (
    c === 'MissingOrInvalidTask' ||
    c === 'TaskNotFound' ||
    c === 'Task not found' ||
    c.toLowerCase() === 'tasknotfound'
  );
}

/** User-visible category line in the popover header (replaces raw compiler categories where needed). */
export function userFacingErrorCategoryHeadline(category: string | undefined, isError: boolean): string {
  if (isTaskNotFoundCategory(category)) return ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.title;
  const trimmed = category?.trim();
  if (trimmed) return trimmed;
  return isError ? 'Error' : 'Warning';
}

/**
 * Formats error message by removing technical IDs (UUIDs, taskId, nodeId)
 * and showing only a descriptive summary
 */
function formatErrorMessage(message: string, category?: string): string {
  if (isTaskNotFoundCategory(category)) {
    return ERROR_TOOLTIP_TASK_NOT_FOUND_COPY.body;
  }

  // Remove UUIDs (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  let formatted = message.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '');

  // Remove partial UUIDs or strange IDs (e.g., "-Irlftv1qi", "siglia strana")
  formatted = formatted.replace(/[-\s][a-zA-Z0-9]{8,}/g, ''); // Remove IDs after dash or space
  formatted = formatted.replace(/[a-zA-Z0-9]{8,}/g, ''); // Remove standalone long IDs

  // Remove taskId/nodeId patterns (e.g., "taskId: xxx", "nodeId: xxx")
  formatted = formatted.replace(/\b(taskId|nodeId|rowId|edgeId):\s*[^\s,;)]+/gi, '');

  // Remove "in node ..." or "in row ..." patterns
  formatted = formatted.replace(/\bin\s+(node|row|task|edge)\s+[^\s,;)]+/gi, '');

  // Remove "Task not found: ..." patterns and keep only the main message
  formatted = formatted.replace(/Task\s+not\s+found[:\s,]*/gi, '');
  formatted = formatted.replace(/row\s+[^\s,;)]+/gi, ''); // Remove "row [ID]"

  // Clean up multiple spaces, commas, and trailing punctuation
  formatted = formatted.replace(/\s+/g, ' ').trim();
  formatted = formatted.replace(/[.,;]\s*[.,;]+/g, '.');
  formatted = formatted.replace(/^[.,;\s]+|[.,;\s]+$/g, ''); // Remove leading/trailing punctuation

  // If after cleaning the message is empty or only punctuation, return a generic message
  if (!formatted || formatted.length < 3) {
    return category || 'Error';
  }

  return formatted;
}

export function ErrorTooltip({ errors, onFix, onClose }: ErrorTooltipProps) {
  if (errors.length === 0) {
    return null;
  }

  // ✅ Group errors by severity - only 'error' and 'warning' are handled
  // 'hint' is defined in the type but not used yet (future design suggestions)
  // ✅ Normalize severity: backend sends "Error"/"Warning" (PascalCase), frontend expects 'error'/'warning' (lowercase)
  const errorErrors = errors.filter(e => normalizeSeverity(e.severity) === 'error');
  const warningErrors = errors.filter(e => normalizeSeverity(e.severity) === 'warning');

  // Show first error or warning
  const primaryError = errorErrors[0] || warningErrors[0];
  if (!primaryError) {
    return null;
  }

  const isError = normalizeSeverity(primaryError.severity) === 'error';
  const hasMultiple = errors.length > 1;

  // ✅ Format message to remove technical IDs
  const formattedMessage = formatErrorMessage(primaryError.message, primaryError.category);

  const categoryDisplay = userFacingErrorCategoryHeadline(primaryError.category, isError);

  const showSeveritySubtitle = !primaryError.category || !isTaskNotFoundCategory(primaryError.category);

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 min-w-[280px] max-w-[400px] text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-0.5">
          {isError ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">
            {categoryDisplay}
          </div>
          {showSeveritySubtitle && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isError ? 'Error' : 'Warning'}
              {hasMultiple && ` (${errors.length} issues)`}
            </div>
          )}
          {!showSeveritySubtitle && hasMultiple && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {`${errors.length} issues`}
            </div>
          )}
        </div>
        {/* ✅ Close button */}
        {onClose && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Body - Message */}
      <div className="mb-3">
        <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {formattedMessage.length > 200
            ? `${formattedMessage.substring(0, 200)}...`
            : formattedMessage}
        </div>
      </div>

      {/* Footer - Fix Button */}
      {onFix && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFix(primaryError);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            <Wrench className="h-3 w-3" />
            <span>Fix</span>
          </button>
        </div>
      )}
    </div>
  );
}
