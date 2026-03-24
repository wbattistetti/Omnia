// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * SaveResult: Result of project save orchestration
 */
export interface SaveResult {
  success: boolean;
  projectId: string;
  duration: number; // milliseconds
  results: {
    catalog?: { success: boolean; error?: string };
    translations?: { success: boolean; error?: string };
    flow?: { success: boolean; error?: string; persistedFlowIds?: string[] };
    tasks?: { success: boolean; saved: number; failed: number; error?: string };
    variables?: { success: boolean; saved: number; error?: string };
    templates?: { success: boolean; saved: number; failed: number; error?: string };
    conditions?: { success: boolean; saved: number; error?: string };
  };
  errors?: string[];
}
