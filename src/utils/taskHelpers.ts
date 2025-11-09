import type { NodeRowData } from '../types/project';

/**
 * Helper functions for Task/Instance migration
 * These functions provide backward-compatible access to Task IDs
 */

/**
 * Get Task ID from a row
 * Backward compatible: if taskId is not present, uses row.id as instanceId
 *
 * @param row - NodeRowData row
 * @returns Task ID (taskId if present, otherwise row.id)
 */
export function getTaskIdFromRow(row: NodeRowData): string {
  return row.taskId || row.id;
}

/**
 * Check if a row has been migrated to new Task model
 *
 * @param row - NodeRowData row
 * @returns true if row has taskId (migrated), false if using legacy (row.id = instanceId)
 */
export function isRowMigrated(row: NodeRowData): boolean {
  return !!row.taskId;
}

/**
 * Get instance ID from a row (for backward compatibility with InstanceRepository)
 *
 * @param row - NodeRowData row
 * @returns Instance ID (taskId if present, otherwise row.id)
 */
export function getInstanceIdFromRow(row: NodeRowData): string {
  // For now, taskId and instanceId are the same (1:1 relationship)
  // In the future, they might diverge, but for migration they're the same
  return row.taskId || row.id;
}

