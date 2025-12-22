import { ProjectData, EntityType, Category, ProjectEntityItem, TaskTemplateItem, Macrotask, MacrotaskPayloadNode, MacrotaskPayloadEdge } from '../types/project';
import { v4 as uuidv4 } from 'uuid';
import { IntellisenseItem } from '../components/Intellisense/IntellisenseTypes';
// import { getLabelColor } from '../utils/labelColor';
import { SIDEBAR_TYPE_ICONS, SIDEBAR_TYPE_COLORS } from '../components/Sidebar/sidebarTheme';
import { modeToType } from '../utils/normalizers';
import { generateId } from '../utils/idGenerator';

// Import template data
import agentActsEn from '../../data/templates/utility_gas/agent_acts/en.json';
import backendCallsEn from '../../data/templates/utility_gas/backend_calls/en.json';
import conditionsEn from '../../data/templates/utility_gas/conditions/en.json';
import macroTasksEn from '../../data/templates/utility_gas/macro_tasks/en.json';
import tasksEn from '../../data/templates/utility_gas/tasks/en.json';
import userActsEn from '../../data/templates/utility_gas/user_acts/en.json';

// Template data mapping
const templateData = {
  utility_gas: {
    en: {
      agentActs: agentActsEn,
      userActs: userActsEn,
      backendActions: backendCallsEn,
      conditions: conditionsEn,
      tasks: tasksEn,
      macrotasks: macroTasksEn
    }
  }
};

// Internal project data storage
let projectData: ProjectData = {
  name: '',
  industry: '',
  taskTemplates: [],
  userActs: [],
  backendActions: [],
  conditions: [],
  tasks: [],
  macrotasks: []
};

// Funzione specifica per task templates
const convertTaskTemplatesToCategories = <T extends TaskTemplateItem>(templateArray: any[]): Category<T>[] => {
  if (!Array.isArray(templateArray)) {
    console.warn("Expected an array for template data, but received:", templateArray);
    return [];
  }
  const categoriesMap: { [key: string]: Category<T> } = {};
  templateArray.forEach((item: any) => {
    const categoryName = item.category || item.categoryDry || 'Uncategorized';
    const categoryKey = categoryName.replace(/\s+/g, '_').toLowerCase();
    if (!categoriesMap[categoryKey]) {
      categoriesMap[categoryKey] = {
        id: uuidv4(),
        name: categoryName,
        items: []
      };
    }
    categoriesMap[categoryKey].items.push(({
      id: item.id || uuidv4(),
      name: item.label || item.shortLabel || item.name || 'Unnamed Item',
      description: item.description || item.label || item.shortLabel || item.name || '',
      userActs: item.userActs,
      // Preserve fields needed for UI badges/icons
      type: item.type,
      mode: item.mode || 'Message',
      shortLabel: item.shortLabel,
      data: item.data,
      categoryType: 'taskTemplates'
    } as unknown) as T);
  });
  return Object.values(categoriesMap);
};

// Versione non generica per le altre entità
const convertTemplateDataToCategories = (templateArray: any[]): Category[] => {
  if (!Array.isArray(templateArray)) {
    console.warn("Expected an array for template data, but received:", templateArray);
    return [];
  }
  const categoriesMap: { [key: string]: Category } = {};
  templateArray.forEach((item: any) => {
    const categoryName = item.category || item.categoryDry || 'Uncategorized';
    const categoryKey = categoryName.replace(/\s+/g, '_').toLowerCase();
    if (!categoriesMap[categoryKey]) {
      categoriesMap[categoryKey] = {
        id: uuidv4(),
        name: categoryName,
        items: []
      };
    }
    categoriesMap[categoryKey].items.push({
      id: item.id || uuidv4(),
      name: item.label || item.shortLabel || item.name || 'Unnamed Item',
      description: item.description || item.label || item.shortLabel || item.name || ''
    });
  });
  return Object.values(categoriesMap);
};

// Helper per accesso type-safe a ProjectData
// function getCategoriesByType(data: ProjectData, type: EntityType): Category[] {
//   return (data as ProjectData)[type] || [];
// }

export const ProjectDataService = {
  async loadActsFromProject(projectId: string): Promise<void> {
    const startTime = performance.now();
    console.log(`[PERF][${new Date().toISOString()}] 📦 START loadActsFromProject`, { projectId });

    // ✅ OPTIMIZATION: Load acts, project conditions, and factory conditions in parallel
    const parallelStart = performance.now();
    const [actsRes, projectCondRes, factoryCondRes] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(projectId)}/acts`),
      fetch(`/api/projects/${encodeURIComponent(projectId)}/conditions`),
      fetch('/api/factory/conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: projectData.industry || '', scope: ['global', 'industry'] })
      })
    ]);
    console.log(`[PERF][${new Date().toISOString()}] ✅ END parallel fetch`, {
      duration: `${(performance.now() - parallelStart).toFixed(2)}ms`
    });

    // Process acts
    const actsStart = performance.now();
    if (!actsRes.ok) throw new Error('Failed to load project acts');
    const json = await actsRes.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    console.log(`[PERF][${new Date().toISOString()}] ✅ END parse acts`, {
      duration: `${(performance.now() - actsStart).toFixed(2)}ms`,
      itemsCount: items.length
    });

    // Process conditions
    const conditionsStart = performance.now();
    let conditions: any[] = [];
    try {
      // Process project conditions
      if (projectCondRes.ok) {
        const projectJson = await projectCondRes.json();
        const projectConditions = Array.isArray(projectJson?.items) ? projectJson.items : [];
        conditions.push(...projectConditions);
        console.log(`[PERF][${new Date().toISOString()}] ✅ END parse project conditions`, {
          projectId,
          count: projectConditions.length
        });
      }

      // Process factory conditions
      if (factoryCondRes.ok) {
        const globalConditions = await factoryCondRes.json();
        conditions.push(...globalConditions);
        console.log(`[PERF][${new Date().toISOString()}] ✅ END parse factory conditions`, {
          count: globalConditions.length,
          total: conditions.length
        });
      }
    } catch (e) {
      console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR parse conditions`, {
        error: e
      });
    }
    console.log(`[PERF][${new Date().toISOString()}] ✅ END load conditions`, {
      duration: `${(performance.now() - conditionsStart).toFixed(2)}ms`,
      totalConditions: conditions.length
    });

    const convertStart = performance.now();
    projectData = {
      name: projectData.name || '',
      industry: projectData.industry || '',
      taskTemplates: this.convertToCategories(items, 'taskTemplates'),
      userActs: [],
      backendActions: [],
      conditions: this.convertToCategories(conditions, 'conditions'),
      tasks: [],
      macrotasks: []
    };
    console.log(`[PERF][${new Date().toISOString()}] ✅ END convertToCategories`, {
      duration: `${(performance.now() - convertStart).toFixed(2)}ms`
    });

    const totalDuration = performance.now() - startTime;
    console.log(`[PERF][${new Date().toISOString()}] 🎉 COMPLETE loadActsFromProject`, {
      projectId,
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      totalDurationSeconds: `${(totalDuration / 1000).toFixed(2)}s`
    });
  },
  async loadTaskTemplatesFromFactory(projectIndustry?: string, projectId?: string): Promise<void> {
    console.log('[ProjectDataService] loadTaskTemplatesFromFactory CALLED with industry:', projectIndustry, 'projectId:', projectId);

    try {
      const { taskTemplateServiceV2 } = await import('./TaskTemplateServiceV2');

      // Costruisci scopes
      // IMPORTANTE: Include sempre "general" per template built-in e generali
      const scopes = ['general'];
      if (projectIndustry && projectIndustry !== 'undefined') {
        scopes.push(`industry:${projectIndustry}`);
      }

      // Aggiungi scope client se projectId è fornito
      if (projectId) {
        scopes.push(`client:${projectId}`);
      }

      console.log('[ProjectDataService] Scopes to load:', scopes);

      // Carica templates
      const templates = await taskTemplateServiceV2.loadTaskTemplates(
        scopes,
        'NodeRow', // Context per Intellisense
        projectId, // projectId per includere template client-specific
        projectIndustry && projectIndustry !== 'undefined' ? projectIndustry : undefined
      );

      console.log('[ProjectDataService] Templates loaded:', templates.length);

      // Converti al formato IntellisenseItem
      const intellisenseItems = taskTemplateServiceV2.convertToIntellisenseFormat(templates);

      console.log('[ProjectDataService] Converted to IntellisenseItems:', intellisenseItems.length);
      if (intellisenseItems.length > 0) {
        console.log('[ProjectDataService] Sample IntellisenseItem:', {
          id: intellisenseItems[0].id,
          label: intellisenseItems[0].label,
          type: intellisenseItems[0].type,
          mode: intellisenseItems[0].mode,
          templateId: intellisenseItems[0].templateId
        });
      }

      projectData = {
        name: projectData.name || '',
        industry: projectData.industry || '',
        taskTemplates: this.convertToCategories(intellisenseItems, 'taskTemplates'),
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: []
      };

      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log(`✅ [ProjectDataService] TaskTemplates loaded successfully!`);
      console.log(`   Categories: ${projectData.taskTemplates.length}`);
      console.log(`   Total items: ${intellisenseItems.length}`);
      console.log('═══════════════════════════════════════════════════════════════════════════');

    } catch (error) {
      console.error('[ProjectDataService] loadTaskTemplatesFromFactory FAILED:', error);
      throw error;
    }
  },

  // --- Instances API helpers ---
  async createInstance(projectId: string, payload: { baseActId: string; mode: 'Message' | 'DataRequest' | 'DataConfirmation'; message?: any; overrides?: any }): Promise<any> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('createInstance_failed');
    return res.json();
  },
  async updateInstance(projectId: string, instanceId: string, updates: any): Promise<any> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instances/${encodeURIComponent(instanceId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('updateInstance_failed');
    return res.json();
  },
  async getInstances(projectId: string, ids?: string[]): Promise<any> {
    const qs = ids && ids.length ? `?ids=${ids.map(encodeURIComponent).join(',')}` : '';
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instances${qs}`);
    if (!res.ok) throw new Error('getInstances_failed');
    return res.json();
  },

  async bulkCreateInstances(projectId: string, items: Array<{ baseActId: string; mode: 'Message' | 'DataRequest' | 'DataConfirmation'; message?: any; overrides?: any }>): Promise<any> {
    if (!items || items.length === 0) return { ok: true, inserted: 0 };
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instances/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
    });
    if (!res.ok) throw new Error('bulkCreateInstances_failed');
    return res.json();
  },
  makeId(): string {
    return generateId();
  },
  async initializeProjectData(templateName: string, language: string, projectIndustry?: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to load from separate collections with scope filtering first
    try {
      console.log('>>> [ProjectDataService] Loading from separate collections with scope filtering...');

      const industry = projectIndustry || templateName;
      const scopeQuery = {
        industry: industry,
        scope: ['global', 'industry']
      };

      // Load from each collection separately
      const [taskTemplatesRes, backendCallsRes, conditionsRes, tasksRes, macroTasksRes] = await Promise.all([
        fetch(`/api/factory/task-templates-v2?scopes=general${projectIndustry && projectIndustry !== 'undefined' ? `,industry:${projectIndustry}` : ''}`),
        fetch('/api/factory/backend-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scopeQuery)
        }),
        fetch('/api/factory/conditions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scopeQuery)
        }),
        fetch('/api/factory/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scopeQuery)
        }),
        fetch('/api/factory/macro-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scopeQuery)
        })
      ]);

      // Process task templates
      const taskTemplatesItems = taskTemplatesRes.ok ? await taskTemplatesRes.json() : [];

      const [backendCalls, conditions, tasks, macroTasks] = await Promise.all([
        backendCallsRes.ok ? backendCallsRes.json() : [],
        conditionsRes.ok ? conditionsRes.json() : [],
        tasksRes.ok ? tasksRes.json() : [],
        macroTasksRes.ok ? macroTasksRes.json() : []
      ]);

      const totalItems = taskTemplatesItems.length + backendCalls.length + conditions.length + tasks.length + macroTasks.length;
      console.log('>>> [ProjectDataService] Received items:', {
        taskTemplates: taskTemplatesItems.length,
        backendCalls: backendCalls.length,
        conditions: conditions.length,
        tasks: tasks.length,
        macroTasks: macroTasks.length,
        total: totalItems
      });

      if (totalItems > 0) {
        // Convert to categories format
        // Migrate tasks to macrotasks
        const tasksCategories = this.convertToCategories(tasks, 'macrotasks');
        const macroTasksCategories = this.convertToCategories(macroTasks, 'macrotasks');
        // Merge tasks and macrotasks into macrotasks
        const allMacrotasks = [...tasksCategories, ...macroTasksCategories];

        const groupedData = {
          taskTemplates: this.convertToCategories(taskTemplatesItems, 'taskTemplates'),
          userActs: [],
          backendActions: this.convertToCategories(backendCalls, 'backendActions'),
          conditions: this.convertToCategories(conditions, 'conditions'),
          tasks: [], // Deprecated: kept empty for compatibility
          macrotasks: allMacrotasks
        };

        projectData = {
          name: '',
          industry: industry,
          ...groupedData
        };

        console.log('>>> [ProjectDataService] Successfully loaded from separate collections');
        return;
      }
    } catch (error) {
      console.warn('>>> [ProjectDataService] Separate collections system not available, falling back to template system:', error);
    }

    // Fallback to template system
    const template = templateData[templateName as keyof typeof templateData];
    if (!template) {
      console.warn(`Template ${templateName} not found, using empty data`);
      projectData = {
        name: '',
        industry: projectIndustry || templateName,
        taskTemplates: [],
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: []
      };
      return;
    }

    const languageData = template[language as keyof typeof template];
    if (!languageData) {
      console.warn(`Language ${language} not found for template ${templateName}, using empty data`);
      projectData = {
        name: '',
        industry: projectIndustry || templateName,
        taskTemplates: [],
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: []
      };
      return;
    }

    // Fallback to bundled JSON
    projectData = {
      name: '',
      industry: projectIndustry || templateName,
      taskTemplates: convertTaskTemplatesToCategories<TaskTemplateItem>(languageData.agentActs),
      userActs: convertTemplateDataToCategories(languageData.userActs),
      backendActions: convertTemplateDataToCategories(languageData.backendActions),
      conditions: convertTemplateDataToCategories(languageData.conditions),
      tasks: [], // Deprecated: tasks migrated to macrotasks
      macrotasks: [
        ...convertTemplateDataToCategories(languageData.tasks || []),
        ...convertTemplateDataToCategories(languageData.macrotasks || [])
      ]
    };
  },

  // Helper method to group catalog items by type
  groupCatalogItemsByType(catalogItems: any[]): { [key: string]: Category[] } {
    const result = {
      taskTemplates: [] as Category[],
      userActs: [] as Category[],
      backendActions: [] as Category[],
      conditions: [] as Category[],
      tasks: [] as Category[],
      macrotasks: [] as Category[]
    };

    // Group items by type
    const itemsByType: { [key: string]: any[] } = {};
    catalogItems.forEach(item => {
      const type = item.type;
      if (!itemsByType[type]) itemsByType[type] = [];
      itemsByType[type].push(item);
    });

    // Convert each type to categories
    Object.entries(itemsByType).forEach(([type, items]) => {
      const categoriesMap: { [key: string]: Category } = {};

      items.forEach(item => {
        const categoryName = item.category || 'Uncategorized';
        const key = categoryName.replace(/\s+/g, '_').toLowerCase();

        if (!categoriesMap[key]) {
          categoriesMap[key] = {
            id: uuidv4(),
            name: categoryName,
            items: []
          };
        }

        const convertedItem = {
          id: item._id || uuidv4(),
          name: item.name?.it || item.name?.en || item.label || 'Unnamed',
          description: item.description?.it || item.description?.en || item.description || '',
          type: (item as any)?.type,
          mode: item.mode || 'Message',
          shortLabel: item.shortLabel,
          data: item.data,
          ddt: item.ddt,
          prompts: item.prompts || {},
          scope: item.scope,
          industry: item.industry,
          status: item.status,
          version: item.version,
          tags: item.tags || []
        };

        categoriesMap[key].items.push(convertedItem);
      });

      // Map type to result key
      const resultKey = this.mapCatalogTypeToResultKey(type);
      if (resultKey && result[resultKey as keyof typeof result]) {
        (result[resultKey as keyof typeof result] as Category[]) = Object.values(categoriesMap);
      }
    });

    return result;
  },

  // Helper method to convert items to categories format
  convertToCategories(items: any[], entityType: string): Category[] {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const categoriesMap: { [key: string]: Category } = {};

    items.forEach((item: any) => {
      const categoryName = item.category || 'Uncategorized';
      const key = categoryName.replace(/\s+/g, '_').toLowerCase();

      if (!categoriesMap[key]) {
        categoriesMap[key] = {
          id: uuidv4(),
          name: categoryName,
          items: []
        };
      }

      const convertedItem = {
        id: item._id || uuidv4(),
        name: item.name || item.label || 'Unnamed',
        description: item.description || '',
        type: (item as any)?.type,
        mode: item.mode || 'Message',
        shortLabel: item.shortLabel,
        data: item.data,
        ddt: item.ddt,
        // Include ProblemClassification payload persisted per act (project-owned)
        problem: (item as any)?.problem,
        prompts: item.prompts || {},
        scope: item.scope,
        industry: item.industry,
        status: item.status,
        version: item.version,
        tags: item.tags || [],
        factoryId: (item.origin === 'factory' && item.originId) ? item.originId : (item.factoryId || null),
        isInMemory: false
      };

      categoriesMap[key].items.push(convertedItem);
    });

    return Object.values(categoriesMap);
  },

  // Create a Macrotask entity and return it
  async addMacrotask(name: string, description = '', payload: { nodes: MacrotaskPayloadNode[]; edges: MacrotaskPayloadEdge[] },
    meta?: { nodeIds?: string[]; edgeIds?: string[]; entryEdges?: string[]; exitEdges?: string[]; bounds?: { x: number; y: number; w: number; h: number } }): Promise<Macrotask> {
    const cat = findOrCreateMacrotaskCategory('Macrotasks');
    const macrotask: Macrotask = {
      id: uuidv4(),
      name,
      description,
      nodeIds: meta?.nodeIds || [],
      edgeIds: meta?.edgeIds || [],
      entryEdges: meta?.entryEdges || [],
      exitEdges: meta?.exitEdges || [],
      bounds: meta?.bounds || { x: 0, y: 0, w: 0, h: 0 },
      payload
    };
    (cat.items as any).push(macrotask);
    return macrotask;
  },

  async updateMacrotask(macrotaskId: string, updates: Partial<Macrotask>): Promise<void> {
    const cats = ensureMacrotasksCategories();
    for (const c of cats) {
      const t = (c.items as any).find((it: any) => it.id === macrotaskId);
      if (t) { Object.assign(t, updates); return; }
    }
  },

  async getMacrotasks(): Promise<Macrotask[]> {
    const out: Macrotask[] = [];
    const cats = ensureMacrotasksCategories();
    for (const c of cats) out.push(...(c.items as any));
    return out;
  },

  async loadProjectData(): Promise<ProjectData> {
    const startTime = performance.now();
    console.log(`[PERF][${new Date().toISOString()}] 📊 START loadProjectData`);
    await new Promise(resolve => setTimeout(resolve, 50));
    const result = { ...projectData };
    const duration = performance.now() - startTime;
    console.log(`[PERF][${new Date().toISOString()}] ✅ END loadProjectData`, {
      duration: `${duration.toFixed(2)}ms`
    });
    return result;
  },

  async addCategory(type: EntityType, name: string): Promise<Category> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const newCategory: Category = {
      id: uuidv4(),
      name,
      items: []
    };
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    arr.push(newCategory);
    return newCategory;
  },

  async deleteCategory(type: EntityType, categoryId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    (projectData as ProjectData)[type] = arr.filter(c => c.id !== categoryId);
  },

  async updateCategory(type: EntityType, categoryId: string, updates: Partial<Category>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    const category = arr.find(c => c.id === categoryId);
    if (category) {
      Object.assign(category, updates);
    }
  },

  async addItem(type: EntityType, categoryId: string, name: string, description = '', scope?: 'global' | 'industry'): Promise<ProjectEntityItem> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    const category = arr.find(c => c.id === categoryId);
    if (!category) throw new Error('Category not found');

    const newItem: ProjectEntityItem = {
      id: uuidv4(),
      name,
      description
    };
    // Insert alphabetically (case-insensitive, locale-aware)
    const items = category.items as any[];
    const norm = (s: string) => (s || '').toLocaleLowerCase();
    let inserted = false;
    for (let i = 0; i < items.length; i++) {
      const curr = String(items[i]?.name || items[i]?.label || '');
      if (norm(name).localeCompare(norm(curr)) < 0) {
        items.splice(i, 0, newItem);
        inserted = true;
        break;
      }
    }
    if (!inserted) items.push(newItem);
    return newItem;
  },

  async deleteItem(type: EntityType, categoryId: string, itemId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    const category = arr.find(c => c.id === categoryId);
    if (category) {
      category.items = category.items.filter((i: any) => i.id !== itemId);
    }
  },

  async updateItem(type: EntityType, categoryId: string, itemId: string, updates: Partial<ProjectEntityItem>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const arr = (projectData as ProjectData)[type];
    if (!arr) throw new Error(`Entity type ${type} is not defined in projectData`);
    const category = arr.find(c => c.id === categoryId);
    const item = category?.items.find((i: any) => i.id === itemId);
    if (item) {
      Object.assign(item, updates);
      // If we updated an agent act with embedded DDT, try saving to factory DB (best-effort)
      if (type === 'taskTemplates') {
        try {
          const payload = { _id: item._id || item.id, label: (item as any).name, description: (item as any).description, category: (category as any)?.name, type: (item as any)?.type, mode: (item as any)?.mode || 'Message', shortLabel: (item as any)?.shortLabel, data: (item as any)?.data, ddt: (item as any)?.ddt, prompts: (item as any)?.prompts || {} };
          await fetch(`/api/factory/task-templates-v2/${encodeURIComponent(payload._id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } catch (e) { console.warn('[ProjectDataService] save task template failed', e); }
      }
    }
  },

  async exportProjectData(): Promise<string> {
    return JSON.stringify(projectData, null, 2);
  },

  /** Update the ProblemClassification payload for a Task Template by templateId (in-memory only) */
  setTaskTemplateProblemById(templateId: string, problem: any | null): void {
    try {
      const cats: any[] = (projectData as any)?.taskTemplates || [];
      for (const c of cats) {
        const items: any[] = c?.items || [];
        for (const it of items) {
          if (String(it?.id || it?._id) === String(actId)) {
            (it as any).problem = problem || null;
            return;
          }
        }
      }
    } catch { }
  },

  /** Persist Task Templates created in-memory into the project's DB (idempotent upsert). Called only on explicit Save. */
  async saveProjectTaskTemplatesToDb(projectId: string, data?: ProjectData): Promise<void> {
    try {
      const pd: any = data || projectData;
      const categories: any[] = Array.isArray(pd?.taskTemplates) ? pd.taskTemplates : [];
      const itemsToPersist: any[] = [];
      for (const cat of categories) {
        const items: any[] = Array.isArray(cat?.items) ? cat.items : [];
        for (const it of items) {
          // Persist when: newly created in-memory, local project acts (no factoryId), or when a Problem payload exists/changed
          const shouldPersist = Boolean(it?.problem) || (it?.isInMemory === true) || !it?.factoryId;
          if (!shouldPersist) continue;
          itemsToPersist.push({
            _id: it.id || it._id,
            name: it.name || it.label,
            label: it.label || it.name,
            description: it.description || '',
            type: it.type,
            mode: it.mode || 'Message',
            category: cat.name || null,
            scope: it.scope || 'industry',
            industry: it.industry || pd?.industry || null,
            ddtSnapshot: it.ddtSnapshot || null,
            // Persist ProblemClassification payload
            problem: it.problem || null
          });
        }
      }
      if (!itemsToPersist.length) return;
      // Use bulk endpoint to minimize round-trips
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/acts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToPersist })
      });
      if (!res.ok) {
        try {
          const txt = await res.text();
          console.warn('[Acts][bulk][error]', { status: res.status, statusText: res.statusText, body: txt });
        } catch (e) {
          console.warn('[Acts][bulk][error.no-body]', { status: res.status, statusText: res.statusText });
        }
      } else {
      }
    } catch { }
  },

  /** Persist Conditions with scripts to project DB. Called only on explicit Save. */
  async saveProjectConditionsToDb(projectId: string, data?: ProjectData): Promise<void> {
    try {
      const pd: any = data || projectData;
      const categories: any[] = Array.isArray(pd?.conditions) ? pd.conditions : [];
      const itemsToPersist: any[] = [];

      for (const cat of categories) {
        const items: any[] = Array.isArray(cat?.items) ? cat.items : [];
        for (const item of items) {
          if (item?.data?.script) {
            const conditionId = item.id || item._id;
            itemsToPersist.push({
              _id: conditionId,
              name: item.name || item.label,
              label: item.label || item.name,
              description: item.description || '',
              data: item.data
            });
          }
        }
      }

      if (!itemsToPersist.length) return;

      // Use bulk endpoint to minimize round-trips
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/conditions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToPersist })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[SAVE_CONDITION] ❌ Failed to save conditions', {
          projectId,
          status: res.status,
          error: errorText
        });
      } else {
        const result = await res.json();
        console.log('[SAVE_CONDITION] ✅ Conditions saved successfully', {
          projectId,
          inserted: result.inserted,
          updated: result.updated,
          total: result.total
        });
      }
    } catch (e: any) {
      console.error('[SAVE_CONDITION] ❌ Error in saveProjectConditionsToDb', {
        error: e.message,
        stack: e.stack
      });
    }
  },

  async importProjectData(jsonData: string): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData);
      projectData = importedData;
    } catch (error) {
      throw new Error('Invalid JSON data');
    }
  },

  /** Persist current in-memory Task Templates into Factory DB (idempotent upsert) */
  async saveTaskTemplatesToFactory(): Promise<{ saved: number }> {
    const templateCategories: any[] = (projectData as any)?.taskTemplates || [];
    let count = 0;
    for (const cat of templateCategories) {
      for (const item of (cat.items || [])) {
        try {
          const payload = {
            id: item._id || item.id,
            label: item.name,
            description: item.description || '',
            category: cat.name,
            type: (item as any)?.type,
            templateId: (item as any)?.templateId || (item as any)?.type,
            defaultValue: item.data || {},
            scope: 'general'
          };
          const res = await fetch(`/api/factory/task-templates-v2/${encodeURIComponent(payload.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) count += 1;
        } catch (e) {
          console.warn('[ProjectDataService] saveTaskTemplatesToFactory failed for', item?.id, e);
        }
      }
    }
    return { saved: count };
  }
};

// --- Task helpers ---
function ensureMacrotasksCategories(): Category[] {
  if (!projectData.macrotasks) projectData.macrotasks = [] as any;
  return projectData.macrotasks as unknown as Category[];
}

function findOrCreateMacrotaskCategory(preferredName: string = 'Uncategorized'): Category {
  const cats = ensureMacrotasksCategories();
  // If any category already exists, reuse the first one to avoid duplicate lists
  if (cats.length > 0) return cats[0];
  const created: Category = { id: uuidv4(), name: preferredName, items: [] };
  cats.push(created);
  return created;
}


export async function getAllDialogueTemplates() {
  const res = await fetch('/api/factory/dialogue-templates');
  if (!res.ok) throw new Error('Errore nel recupero dei DataDialogueTemplates');
  const data = await res.json();
  try {
    // ✅ NUOVA STRUTTURA: Usa subDataIds invece di mainData
    const snap = Array.isArray(data) ? data.map((d: any) => ({
      label: d?.label,
      subDataIds: d?.subDataIds || [],
      hasStepPrompts: !!d?.stepPrompts
    })) : [];
    // RIMOSSO: console.log che causava loop infinito
  } catch { }
  return data;
}

// Translations services (factory DB)
export async function getIDETranslations() {
  const res = await fetch('/api/factory/ide-translations');
  if (!res.ok) throw new Error('Errore nel recupero di IDETranslations');
  return res.json();
}

export async function getDataDialogueTranslations() {
  const res = await fetch('/api/factory/data-dialogue-translations');
  if (!res.ok) throw new Error('Errore nel recupero di DataDialogueTranslations');
  return res.json();
}

export async function getTemplateTranslations(keys: string[]): Promise<Record<string, { en: string; it: string; pt: string }>> {
  if (!keys || keys.length === 0) return {};
  const res = await fetch('/api/factory/template-translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys })
  });
  if (!res.ok) throw new Error('Errore nel recupero di Template Translations');
  return res.json();
}

export async function saveProjectTranslations(
  projectId: string,
  translations: Array<{ guid: string; language: string; text: string; type?: string }>
): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`/api/projects/${projectId}/translations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ translations })
  });
  if (!res.ok) throw new Error('Errore nel salvataggio di Project Translations');
  return res.json();
}

export async function loadProjectTranslations(
  projectId: string,
  guids: string[]
): Promise<Record<string, { en: string; it: string; pt: string }>> {
  if (!guids || guids.length === 0) return {};
  const res = await fetch(`/api/projects/${projectId}/translations/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guids })
  });
  if (!res.ok) throw new Error('Errore nel caricamento di Project Translations');
  return res.json();
}

// Load ALL project translations (for project opening)
export async function loadAllProjectTranslations(
  projectId: string,
  locale: string = 'pt'
): Promise<Record<string, string>> {
  const startTime = performance.now();
  console.log(`[PERF][${new Date().toISOString()}] 🌐 START loadAllProjectTranslations`, { projectId, locale });

  const res = await fetch(`/api/projects/${projectId}/translations/all?locale=${locale}`);
  if (!res.ok) {
    const duration = performance.now() - startTime;
    console.error(`[PERF][${new Date().toISOString()}] ❌ ERROR loadAllProjectTranslations`, {
      duration: `${duration.toFixed(2)}ms`,
      projectId,
      status: res.status
    });
    throw new Error('Errore nel recupero di tutte le Project Translations');
  }

  const jsonStart = performance.now();
  const result = await res.json();
  const jsonDuration = performance.now() - jsonStart;
  const totalDuration = performance.now() - startTime;

  console.log(`[PERF][${new Date().toISOString()}] ✅ END loadAllProjectTranslations`, {
    duration: `${totalDuration.toFixed(2)}ms`,
    jsonParseDuration: `${jsonDuration.toFixed(2)}ms`,
    translationsCount: Object.keys(result).length
  });

  return result;
}

export async function saveDataDialogueTranslations(payload: Record<string, string>) {
  const res = await fetch('/api/factory/data-dialogue-translations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.status === 404) {
    // Backend not ready for dynamic translations: no-op to allow saving DDTs
    return { skipped: true };
  }
  if (!res.ok) throw new Error('Errore nel salvataggio di DataDialogueTranslations');
  return res.json();
}

/**
 * Prepare intellisense data from project data
 */
export function prepareIntellisenseData(
  data: ProjectData
): IntellisenseItem[] {
  const intellisenseItems: IntellisenseItem[] = [];

  // Process each entity type
  Object.entries(data).forEach(([entityType, _categories]) => {
    const Icon = SIDEBAR_TYPE_ICONS[entityType as EntityType];
    const color = SIDEBAR_TYPE_COLORS[entityType as EntityType]?.color;
    if (!Icon || !color) return;
    const typedEntityType = entityType as EntityType;
    const typedCategories: Category[] = (data as ProjectData)[typedEntityType] || [];
    typedCategories.forEach((category: Category) => {
      category.items.forEach((item: any) => {
        // Usa il mode deterministico dal DB Factory; niente euristiche a runtime
        const mode = ((item as any)?.mode) || 'Message';
        // Use shared normalizer mapping
        const type = (item as any)?.type || modeToType(mode as any);
        // try { console.log('[CreateFlow] intellisense.item', { label: item?.name || item?.label, mode, type }); } catch {}
        intellisenseItems.push({
          id: `${entityType}-${category.id}-${item.id}`,
          actId: item.id,
          factoryId: item._id,
          label: item.label || item.name || item.discursive || item.shortLabel || 'Unnamed',
          shortLabel: item.shortLabel || item.label || item.name || item.discursive || '',
          name: item.name || item.label || item.shortLabel || item.discursive || '',
          description: item.description || item.discursive || item.label || item.name || '',
          category: category.name,
          categoryType: typedEntityType,
          iconComponent: undefined, // solo riferimento al componente
          color,
          mode,
          type,
          userActs: item.userActs,
          uiColor: undefined // o la tua logica per il colore di sfondo
        });
      });
    });
  });

  return intellisenseItems;
};