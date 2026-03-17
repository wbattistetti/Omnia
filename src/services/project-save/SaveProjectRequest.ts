// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Task } from '@types/taskTypes';
import type { Flow } from '@flows/FlowTypes';

/**
 * SaveProjectRequest: Contract for project save payload
 * 
 * This represents the complete payload structure sent to backend endpoints.
 * Each section corresponds to a specific API endpoint.
 */
export interface SaveProjectRequest {
  version: '1.0';
  projectId: string;
  
  // 1. Catalog timestamp update
  catalog: {
    projectId: string;
    ownerCompany?: string | null;
    ownerClient?: string | null;
  };
  
  // 2. Tasks bulk save
  tasks: {
    items: Task[];
    source: 'Project';
  };
  
  // 3. Flow save
  flow: {
    flowId: string;
    flow: Flow<any, any>;
  };
  
  // 4. Variables save
  variables: {
    projectId: string;
    variables: any[]; // Variable[] from VariableCreationService
  };
  
  // 5. Templates save (array of individual template saves)
  templates: Array<{
    templateId: string;
    template: any; // DialogueTask
    isFactory: boolean;
    mongoId?: string;
  }>;
  
  // 6. Conditions bulk save
  conditions: {
    items: Array<{
      id: string;
      label: string;
      description: string;
      expression: {
        script: string;
        executableCode?: string;
        compiledCode?: string;
      };
    }>;
  };
  
  // 7. Translations (handled by translationsContext, not in request)
  // translations: handled separately by translationsContext.saveAllTranslations()
}
