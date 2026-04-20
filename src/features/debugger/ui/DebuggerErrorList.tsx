/**
 * Compile error tree for the flow debugger: flows → row groups → UX messages + FIX.
 * Uses `buildErrorReportTree` from `@components/ChatPanel/errorReportTreeModel`.
 */

import React from 'react';
import type { CompilationError } from '@components/FlowCompiler/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Flow } from '@flows/FlowTypes';
import type { Node, Edge } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { buildErrorReportTree } from '@components/ChatPanel/errorReportTreeModel';
import { compilationErrorFixKey } from '@utils/compilationErrorFix';
import { executeNavigationIntent, resolveNavigationIntent } from '@domain/compileErrors';

function formatErrorWarningCounts(errors: number, warnings: number): string {
  const parts: string[] = [];
  if (errors > 0) {
    parts.push(`${errors} ${errors === 1 ? 'errore' : 'errori'}`);
  }
  if (warnings > 0) {
    parts.push(`${warnings} ${warnings === 1 ? 'avviso' : 'avvisi'}`);
  }
  if (parts.length === 0) return '';
  return parts.join(', ');
}

export interface DebuggerErrorListProps {
  errors: CompilationError[];
  flows: Record<string, Flow<Node<FlowNode>, Edge>>;
  className?: string;
}

export function DebuggerErrorList({ errors, flows, className = '' }: DebuggerErrorListProps) {
  const tree = React.useMemo(() => buildErrorReportTree(errors, flows), [errors, flows]);

  const [collapsedFlows, setCollapsedFlows] = React.useState<Set<string>>(() => new Set());
  const [collapsedRows, setCollapsedRows] = React.useState<Set<string>>(() => new Set());

  const toggleFlow = React.useCallback((flowId: string) => {
    setCollapsedFlows((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  }, []);

  const toggleRow = React.useCallback((key: string) => {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onFix = React.useCallback(async (e: React.MouseEvent, err: CompilationError) => {
    e.stopPropagation();
    try {
      await executeNavigationIntent(resolveNavigationIntent(err));
    } catch (errx) {
      console.error('[DebuggerErrorList] FIX failed:', errx);
    }
  }, []);

  if (errors.length === 0) {
    return (
      <div className={`flex flex-col flex-1 min-h-0 ${className}`}>
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          Nessun errore da mostrare.
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 ${className}`}>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {tree.map((flowRoot) => {
          const flowOpen = !collapsedFlows.has(flowRoot.flowId);
          const FlowIcon = flowRoot.flowVisuals.Icon;
          const fc = formatErrorWarningCounts(flowRoot.errorCount, flowRoot.warningCount);

          return (
            <div
              key={flowRoot.flowId}
              className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleFlow(flowRoot.flowId)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-t-lg transition-colors bg-sky-500/50 hover:bg-sky-500/60 dark:bg-sky-500/50 dark:hover:bg-sky-500/60"
              >
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {flowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <FlowIcon className="h-5 w-5 flex-shrink-0" style={{ color: flowRoot.flowVisuals.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{flowRoot.displayTitle}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{fc}</div>
                </div>
              </button>

              {flowOpen && (
                <div className="px-2 pb-2 space-y-2 border-t border-gray-200/80 dark:border-gray-800 pt-2">
                  {flowRoot.rows.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">Nessun problema in questo flow.</p>
                  ) : (
                    flowRoot.rows.map((rowGroup) => {
                      const rowKey = `${flowRoot.flowId}::${rowGroup.rowKey}`;
                      const rowOpen = !collapsedRows.has(rowKey);
                      const RowIcon = rowGroup.visuals.Icon;
                      const rowBorder = rowGroup.hasBlockingError
                        ? 'border-l-red-500 dark:border-l-red-500'
                        : 'border-l-amber-500 dark:border-l-amber-500';

                      return (
                        <div
                          key={rowKey}
                          className={`rounded-md border border-gray-200 dark:border-gray-800 border-l-4 ${rowBorder} bg-white dark:bg-gray-950 shadow-sm`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleRow(rowKey)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900/80 transition-colors"
                          >
                            <span className="text-gray-400 flex-shrink-0">
                              {rowOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </span>
                            <RowIcon className="h-4 w-4 flex-shrink-0" style={{ color: rowGroup.visuals.iconColor }} />
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-sm font-medium truncate"
                                style={{ color: rowGroup.visuals.labelColor }}
                              >
                                {rowGroup.rowTitle}
                              </div>
                            </div>
                          </button>

                          {rowOpen && (
                            <div className="border-t border-gray-100 dark:border-gray-800/80">
                              <ul className="px-2 pb-1 pt-0 space-y-2">
                                {rowGroup.issues.map((issue) => (
                                  <li
                                    key={`${rowKey}-${compilationErrorFixKey(issue.error)}`}
                                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pl-6 pr-1 pt-2"
                                  >
                                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-snug flex-1">
                                      {issue.message}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(ev) => onFix(ev, issue.error)}
                                      className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                                    >
                                      Fix
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
