// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { TaskType } from '@types/taskTypes';
import { taskRepository } from '@services/TaskRepository';
import { getTaskVisuals, resolveTaskType, hasTaskTree } from '@components/Flowchart/utils/taskVisuals';
import { getTaskIdFromRow } from '@utils/taskHelpers';
import { ensureHexColor } from '@responseEditor/utils/color';
import getIconComponent from '@responseEditor/icons';
import type { Row } from '@types/NodeRowTypes';

export interface UseNodeRowVisualsResult {
  Icon: React.ComponentType<any> | null;
  labelTextColor: string;
  iconColor: string;
  currentTypeForPicker: TaskType | undefined;
  isUndefined: boolean;
}

export interface UseNodeRowVisualsProps {
  row: Row;
  instanceUpdateTrigger?: number; // Force re-render when instance updates
}

/**
 * Custom hook that encapsulates all logic for determining visual elements (Icon, colors) for a NodeRow.
 * This significantly reduces the size of the main component by extracting visual determination logic.
 */
export function useNodeRowVisuals(props: UseNodeRowVisualsProps): UseNodeRowVisualsResult {
  const { row, instanceUpdateTrigger } = props;

  return useMemo(() => {
    // Check if this is an undefined node (no heuristic match found)
    const isUndefined = (row as any)?.isUndefined === true;

    // Default values
    let bgColor = 'transparent';
    let labelTextColor = '';
    let iconColor = '#94a3b8'; // Default grey for icon
    let Icon: React.ComponentType<any> | null = null;
    let currentTypeForPicker: TaskType | undefined = undefined;

    // Get task ID from row
    const taskId = getTaskIdFromRow(row);

    // Try to get task from repository
    if (taskId) {
      try {
        const task = taskRepository.getTask(taskId);
        if (task) {
          // Use task.type (TaskType enum) if available
          if (task.type !== undefined && task.type !== null && task.type !== TaskType.UNDEFINED) {
            // If task has custom icon and color (task "Other"), use them instead of getTaskVisualsByType
            if (task.icon || task.color) {
              const iconName = task.icon || task.iconName || 'Tag';
              const taskColor = task.color ? ensureHexColor(task.color) : '#94a3b8';

              // Create a wrapper component that renders the icon using getIconComponent
              Icon = isUndefined ? HelpCircle : (({ className, style, size, ...props }: any) => {
                const iconEl = getIconComponent(iconName, taskColor);
                return <span className={className} style={style} {...props}>{iconEl}</span>;
              }) as React.ComponentType<any>;
              labelTextColor = isUndefined ? '#94a3b8' : (taskColor || '#94a3b8');
              iconColor = isUndefined ? '#94a3b8' : (taskColor || '#94a3b8');
            } else {
              // Use task.type (enum) directly for visuals instead of resolveTaskType
              // This ensures visuals are always updated with the correct type
              const taskTypeEnum = task.type;
              const has = hasTaskTree(row);
              // Use getTaskVisuals with support for categories
              // Read category from task.category OR from row.heuristics.inferredCategory (if task doesn't exist yet)
              const taskCategory = task.category || ((row as any)?.heuristics?.inferredCategory) || null;
              const visuals = getTaskVisuals(
                taskTypeEnum,
                taskCategory, // Preset category (from task or row.heuristics)
                task.categoryCustom, // Custom category
                has
              );

              // If undefined, use question mark icon instead of normal icon
              Icon = isUndefined ? HelpCircle : visuals.Icon;
              labelTextColor = isUndefined ? '#94a3b8' : visuals.labelColor;
              iconColor = isUndefined ? '#94a3b8' : visuals.iconColor;
            }

            // Set currentTypeForPicker with TaskType enum
            if (!isUndefined) {
              currentTypeForPicker = task.type; // Use task.type (enum) directly
            }
          } else {
            // Task with UNDEFINED type - valid state (heuristic didn't determine type)
            // User must manually select type via type picker
            // NOT an error, so don't log
            // No fallback visual - if UNDEFINED, stays UNDEFINED (question mark)
            Icon = HelpCircle;
            labelTextColor = '#94a3b8';
            iconColor = '#94a3b8';
          }
        } else {
          // Task not found - this is a real problem, but log only if necessary
          // (e.g., if row.id exists but task is not in repository)
          if (row.id && process.env.NODE_ENV === 'development') {
            // Only in dev and only if there's a row.id that should exist
            console.debug('[🎨 NODEROW] Task not found in repository', {
              taskId: taskId,
              rowId: row.id,
              hasRowId: !!row.id
            });
          }
        }
      } catch (err) {
        console.error('[🎨 NODEROW] Error', { taskId, rowId: row.id, error: err });
      }
    }

    // If no task or couldn't determine type
    // Use resolveTaskType to read row.heuristics.type (lazy creation)
    if (!Icon) {
      const resolvedType = resolveTaskType(row);

      // If type was resolved from heuristics, use correct visuals
      if (resolvedType !== TaskType.UNDEFINED) {
        const has = hasTaskTree(row);
        // Read category from row.heuristics.inferredCategory (for lazy creation)
        const rowCategory = (row as any)?.heuristics?.inferredCategory || null;
        const visuals = getTaskVisuals(
          resolvedType,
          rowCategory, // Preset category from row.heuristics
          null, // Custom category (not available in row.heuristics)
          has
        );

        Icon = visuals.Icon;
        labelTextColor = visuals.labelColor;
        iconColor = visuals.iconColor;
        currentTypeForPicker = resolvedType;
      } else {
        // If UNDEFINED, show question mark (no fallback)
        Icon = HelpCircle;
        labelTextColor = '#94a3b8';
        iconColor = '#94a3b8';
      }
    }

    return {
      Icon,
      labelTextColor,
      iconColor,
      currentTypeForPicker,
      isUndefined,
    };
  }, [row, instanceUpdateTrigger]); // Re-compute when row or instanceUpdateTrigger changes
}
