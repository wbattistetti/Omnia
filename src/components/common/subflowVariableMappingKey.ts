/**
 * Deterministic UUID keys for Subflow interface outputs in varId→label maps when the same
 * child variable id appears in multiple Subflow instances (avoids Map key collisions).
 */
import { v5 as uuidv5 } from 'uuid';

export const SUBFLOW_OUTPUT_MAPPING_NAMESPACE = 'a58b8ff9-8d6c-4d6e-9f0a-1b2c3d4e5f60';

export function subflowInterfaceOutputMappingKey(subflowTaskId: string, childVarId: string): string {
  return uuidv5(`${String(subflowTaskId).trim()}::${String(childVarId).trim()}`, SUBFLOW_OUTPUT_MAPPING_NAMESPACE);
}
