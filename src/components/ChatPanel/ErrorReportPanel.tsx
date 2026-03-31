// Error Report Panel: hierarchical flow → row cards → human issues + FIX (aligned with flowchart visuals).

import React from 'react';
import { useCompilationErrors } from '@context/CompilationErrorsContext';
import { runCompilationErrorFix } from '@utils/compilationErrorFix';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useFlowWorkspace } from '@flows/FlowStore';
import type { Node, Edge } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import { normalizeSeverity } from '@utils/severityUtils';
import { buildErrorReportTree, errorMessageWithoutFlowPrefix } from './errorReportTreeModel';
import { compilationErrorFixKey } from '@utils/compilationErrorFix';

function formatErrorWarningCounts(errors: number, warnings: number): string {
  const parts: string[] = [];
  if (errors > 0) {
    parts.push(`${errors} ${errors === 1 ? 'errore' : 'errori'}`);
  }
  if (warnings > 0) {
    parts.push(`${warnings} ${warnings === 1 ? 'avviso' : 'avvisi'}`);
  }
  if (parts.length === 0) return 'Nessun problema';
  return parts.join(', ');
}

export interface ErrorReportPanelProps {
  onClose?: () => void;
}

export function ErrorReportPanel(_props: ErrorReportPanelProps) {
  const { errors } = useCompilationErrors();
  const { flows } = useFlowWorkspace<Node<FlowNode>, Edge>();

  const tree = React.useMemo(() => buildErrorReportTree(errors, flows), [errors, flows]);

  const [collapsedFlows, setCollapsedFlows] = React.useState<Set<string>>(() => new Set());
  const [collapsedRows, setCollapsedRows] = React.useState<Set<string>>(() => new Set());
  const [detailRows, setDetailRows] = React.useState<Set<string>>(() => new Set());

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

  const toggleRowDetail = React.useCallback((key: string) => {
    setDetailRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onFix = React.useCallback(async (e: React.MouseEvent, err: Parameters<typeof runCompilationErrorFix>[0]) => {
    e.stopPropagation();
    try {
      await runCompilationErrorFix(err);
    } catch (errx) {
      console.error('[ErrorReportPanel] FIX failed:', errx);
    }
  }, []);

  if (errors.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-white dark:bg-gray-950">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">Nessun errore di compilazione</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Tutti i controlli sono ok</p>
          </div>
        </div>
      </div>
    );
  }

  const totalErrors = errors.filter((e) => normalizeSeverity(e.severity) === 'error').length;
  const totalWarnings = errors.filter((e) => normalizeSeverity(e.severity) === 'warning').length;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 flex flex-col text-gray-900 dark:text-gray-100">
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {formatErrorWarningCounts(totalErrors, totalWarnings)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                              {rowGroup.sourceErrors.length > 0 && (
                                <div className="px-2 pb-2 pl-8">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRowDetail(rowKey);
                                    }}
                                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                                  >
                                    {detailRows.has(rowKey)
                                      ? 'Nascondi dettagli tecnici'
                                      : `Mostra dettagli tecnici (${rowGroup.sourceErrors.length})`}
                                  </button>
                                  {detailRows.has(rowKey) && (
                                    <ul className="mt-2 space-y-1.5 rounded-md bg-gray-100 dark:bg-gray-900/90 px-2.5 py-2 text-[11px] leading-relaxed text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-700">
                                      {rowGroup.sourceErrors.map((src, i) => (
                                        <li key={`${rowKey}-src-${i}`} className="break-words">
                                          {src.category && (
                                            <span className="font-semibold text-gray-600 dark:text-gray-400 mr-1">
                                              [{src.category}]
                                            </span>
                                          )}
                                          <span className="font-mono text-[10px] sm:text-[11px]">
                                            {(src as { technicalDetail?: string }).technicalDetail?.trim() ||
                                              errorMessageWithoutFlowPrefix(src)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
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
