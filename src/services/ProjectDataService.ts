import { ProjectData, EntityType, Category, ProjectEntityItem, AgentActItem, FlowTask, FlowTaskPayloadNode, FlowTaskPayloadEdge } from '../types/project';
import { v4 as uuidv4 } from 'uuid';
import { IntellisenseItem } from '../components/Intellisense/IntellisenseTypes';
// import { LABEL_COLORS } from '../components/Flowchart/labelColors';
// import { getLabelColor } from '../utils/labelColor';
import { SIDEBAR_TYPE_ICONS, SIDEBAR_TYPE_COLORS } from '../components/Sidebar/sidebarTheme';

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
  agentActs: [],
  userActs: [],
  backendActions: [],
  conditions: [],
  tasks: [],
  macrotasks: []
};

// Funzione specifica per agent acts
const convertAgentActsToCategories = <T extends AgentActItem>(templateArray: any[]): Category<T>[] => {
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
      categoryType: 'agentActs'
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
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/acts`);
    if (!res.ok) throw new Error('Failed to load project acts');
    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    projectData = {
      name: projectData.name || '',
      industry: projectData.industry || '',
      agentActs: this.convertToCategories(items, 'agentActs'),
      userActs: [],
      backendActions: [],
      conditions: [],
      tasks: [],
      macrotasks: []
    };
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
      const [agentActsRes, backendCallsRes, conditionsRes, tasksRes, macroTasksRes] = await Promise.all([
        fetch('/api/factory/agent-acts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scopeQuery)
        }),
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
      
      const [agentActs, backendCalls, conditions, tasks, macroTasks] = await Promise.all([
        agentActsRes.ok ? agentActsRes.json() : [],
        backendCallsRes.ok ? backendCallsRes.json() : [],
        conditionsRes.ok ? conditionsRes.json() : [],
        tasksRes.ok ? tasksRes.json() : [],
        macroTasksRes.ok ? macroTasksRes.json() : []
      ]);
      
      const totalItems = agentActs.length + backendCalls.length + conditions.length + tasks.length + macroTasks.length;
      console.log('>>> [ProjectDataService] Received items:', {
        agentActs: agentActs.length,
        backendCalls: backendCalls.length,
        conditions: conditions.length,
        tasks: tasks.length,
        macroTasks: macroTasks.length,
        total: totalItems
      });
      
      if (totalItems > 0) {
        // Convert to categories format
        const groupedData = {
          agentActs: this.convertToCategories(agentActs, 'agentActs'),
          userActs: [], // Will be loaded from legacy system
          backendActions: this.convertToCategories(backendCalls, 'backendActions'),
          conditions: this.convertToCategories(conditions, 'conditions'),
          tasks: this.convertToCategories(tasks, 'tasks'),
          macrotasks: this.convertToCategories(macroTasks, 'macrotasks')
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
      console.warn('>>> [ProjectDataService] Separate collections system not available, falling back to legacy system:', error);
    }
    
    // Fallback to legacy template system
    const template = templateData[templateName as keyof typeof templateData];
    if (!template) {
      console.warn(`Template ${templateName} not found, using empty data`);
      projectData = {
        name: '',
        industry: projectIndustry || templateName,
        agentActs: [],
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
        agentActs: [],
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: []
      };
      return;
    }

    // Legacy fallback to bundled JSON
    projectData = {
      name: '',
      industry: projectIndustry || templateName,
      agentActs: convertAgentActsToCategories<AgentActItem>(languageData.agentActs),
      userActs: convertTemplateDataToCategories(languageData.userActs),
      backendActions: convertTemplateDataToCategories(languageData.backendActions),
      conditions: convertTemplateDataToCategories(languageData.conditions),
      tasks: convertTemplateDataToCategories(languageData.tasks),
      macrotasks: convertTemplateDataToCategories(languageData.macrotasks)
    };
  },

  // Helper method to group catalog items by type
  groupCatalogItemsByType(catalogItems: any[]): { [key: string]: Category[] } {
    const result = {
      agentActs: [] as Category[],
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

    return Object.values(categoriesMap);
  },

  // Create a FlowTask entity and return it
  async addTask(name: string, description = '', payload: { nodes: FlowTaskPayloadNode[]; edges: FlowTaskPayloadEdge[] },
                meta?: { nodeIds?: string[]; edgeIds?: string[]; entryEdges?: string[]; exitEdges?: string[]; bounds?: { x: number; y: number; w: number; h: number } }): Promise<FlowTask> {
    const cat = findOrCreateTaskCategory('Tasks');
    const task: FlowTask = {
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
    (cat.items as any).push(task);
    return task;
  },

  async updateTask(taskId: string, updates: Partial<FlowTask>): Promise<void> {
    const cats = ensureTasksCategories();
    for (const c of cats) {
      const t = (c.items as any).find((it: any) => it.id === taskId);
      if (t) { Object.assign(t, updates); return; }
    }
  },

  async getTasks(): Promise<FlowTask[]> {
    const out: FlowTask[] = [];
    const cats = ensureTasksCategories();
    for (const c of cats) out.push(...(c.items as any));
    return out;
  },

  async loadProjectData(): Promise<ProjectData> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { ...projectData };
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
      if (type === 'agentActs') {
        try {
          const payload = { _id: item._id || item.id, label: (item as any).name, description: (item as any).description, category: (category as any)?.name, mode: (item as any)?.mode || 'Message', shortLabel: (item as any)?.shortLabel, data: (item as any)?.data, ddt: (item as any)?.ddt, prompts: (item as any)?.prompts || {} };
          await fetch(`/api/factory/agent-acts/${encodeURIComponent(payload._id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } catch (e) { console.warn('[ProjectDataService] save agent act failed', e); }
      }
    }
  },

  async exportProjectData(): Promise<string> {
    return JSON.stringify(projectData, null, 2);
  },

  async importProjectData(jsonData: string): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData);
      projectData = importedData;
    } catch (error) {
      throw new Error('Invalid JSON data');
    }
  },

  /** Persist current in-memory AgentActs into Factory DB (idempotent upsert) */
  async saveAgentActsToFactory(): Promise<{ saved: number }> {
    const actsCategories: any[] = (projectData as any)?.agentActs || [];
    let count = 0;
    for (const cat of actsCategories) {
      for (const item of (cat.items || [])) {
        try {
          const payload = {
            _id: item._id || item.id,
            type: 'agent_act',
            label: item.name,
            description: item.description || '',
            category: cat.name,
            mode: item.mode || 'Message',
            shortLabel: item.shortLabel,
            data: item.data || {},
            ddt: item.ddt || null
          };
          const res = await fetch(`/api/factory/agent-acts/${encodeURIComponent(payload._id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) count += 1;
        } catch (e) {
          console.warn('[ProjectDataService] saveAgentActsToFactory failed for', item?.id, e);
        }
      }
    }
    return { saved: count };
  }
};

// --- Task helpers ---
function ensureTasksCategories(): Category[] {
  if (!projectData.tasks) projectData.tasks = [] as any;
  return projectData.tasks as unknown as Category[];
}

function findOrCreateTaskCategory(preferredName: string = 'Uncategorized'): Category {
  const cats = ensureTasksCategories();
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
    const snap = Array.isArray(data) ? data.map((d: any) => ({ label: d?.label, mains: (d?.mainData || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) })) : [];
    // eslint-disable-next-line no-console
    console.log('[KindPersist][ProjectDataService][load templates]', snap);
  } catch {}
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
          mode: (item as any)?.mode || 'Message',
          userActs: item.userActs,
          uiColor: undefined // o la tua logica per il colore di sfondo
        });
      });
    });
  });
  
  return intellisenseItems;
};