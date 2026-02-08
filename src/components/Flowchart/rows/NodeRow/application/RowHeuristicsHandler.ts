// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType } from '@types/taskTypes';
import { RowHeuristicsService } from '@services/RowHeuristicsService';
import type { Row } from '@types/NodeRowTypes';

export interface RowHeuristicsResult {
  success: boolean;
  taskType: TaskType;
  templateId: string | null;
  isUndefined: boolean;
  inferredCategory: string | null;
  rowType: string | undefined;
  error?: Error;
}

export interface RowUpdateData {
  text: string;
  type: string | undefined;
  mode: string | undefined;
  isUndefined: boolean;
  meta: {
    type: TaskType;
    templateId: string | null;
    inferredCategory: string | null;
  };
}

/**
 * Service to handle heuristic analysis of row labels and prepare row update data.
 * Extracted from NodeRow.tsx to separate business logic from UI concerns.
 */
export class RowHeuristicsHandler {
  /**
   * Analyzes a row label using heuristics and returns the metadata to update the row.
   * This uses the centralized RowHeuristicsService for analysis.
   */
  public static async analyzeRowLabel(
    label: string
  ): Promise<RowHeuristicsResult> {
    try {
      // Use centralized service for heuristic analysis
      const heuristicsResult = await RowHeuristicsService.analyzeRowLabel(label);
      const { taskType, templateId, isUndefined, inferredCategory } =
        heuristicsResult;

      // Convert TaskType enum → string for row.type (backward compatibility)
      const rowType =
        taskType === TaskType.UtteranceInterpretation
          ? 'UtteranceInterpretation'
          : taskType === TaskType.SayMessage
            ? 'Message'
            : taskType === TaskType.ClassifyProblem
              ? 'ProblemClassification'
              : taskType === TaskType.BackendCall
                ? 'BackendCall'
                : undefined;

      return {
        success: true,
        taskType,
        templateId,
        isUndefined,
        inferredCategory,
        rowType,
      };
    } catch (error) {
      console.error('❌ [RowHeuristicsHandler] Error during heuristic analysis', {
        text: label,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        taskType: TaskType.UNDEFINED,
        templateId: null,
        isUndefined: true,
        inferredCategory: null,
        rowType: undefined,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Prepares row update data based on heuristic analysis results.
   * This creates the data structure needed to update a row with metadata.
   */
  public static prepareRowUpdateData(
    row: Row,
    label: string,
    heuristicsResult: RowHeuristicsResult
  ): RowUpdateData {
    // Store metadata in row for lazy task creation
    // LAZY: We don't set taskId - task will be created only when editor is opened
    return {
      text: label,
      type: heuristicsResult.rowType as any,
      mode: heuristicsResult.rowType as any,
      isUndefined: heuristicsResult.isUndefined,
      // LAZY: Store metadata for task creation when editor is opened
      meta: {
        type: heuristicsResult.taskType, // TaskType enum
        templateId: heuristicsResult.templateId, // GUID of template if found
        inferredCategory: heuristicsResult.inferredCategory || null, // Semantic category inferred automatically
      },
    };
  }
}
