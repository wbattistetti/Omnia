import { ProjectData, EntityType, Category, ProjectEntityItem, AgentActItem } from '../types/project';
import { v4 as uuidv4 } from 'uuid';
import { IntellisenseItem } from '../components/Intellisense/IntellisenseTypes';
import { LABEL_COLORS } from '../components/Flowchart/labelColors';
import { getLabelColor } from '../utils/labelColor';
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
    categoriesMap[categoryKey].items.push({
      id: item.id || uuidv4(),
      name: item.label || item.shortLabel || item.name || 'Unnamed Item',
      description: item.description || item.label || item.shortLabel || item.name || '',
      userActs: item.userActs
    } as T);
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
function getCategoriesByType(data: ProjectData, type: EntityType): Category[] {
  return (data as ProjectData)[type] || [];
}

export const ProjectDataService = {
  async initializeProjectData(templateName: string, language: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const template = templateData[templateName as keyof typeof templateData];
    if (!template) {
      console.warn(`Template ${templateName} not found, using empty data`);
      projectData = {
        name: '',
        industry: '',
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
        industry: '',
        agentActs: [],
        userActs: [],
        backendActions: [],
        conditions: [],
        tasks: [],
        macrotasks: []
      };
      return;
    }

    // Convert template data to internal format
    projectData = {
      name: '',
      industry: '',
      agentActs: convertAgentActsToCategories<AgentActItem>(languageData.agentActs),
      userActs: convertTemplateDataToCategories(languageData.userActs),
      backendActions: convertTemplateDataToCategories(languageData.backendActions),
      conditions: convertTemplateDataToCategories(languageData.conditions),
      tasks: convertTemplateDataToCategories(languageData.tasks),
      macrotasks: convertTemplateDataToCategories(languageData.macrotasks)
    };
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

  async addItem(type: EntityType, categoryId: string, name: string, description = ''): Promise<ProjectEntityItem> {
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
    category.items.push(newItem);
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
  }
};

export async function getAllDialogueTemplates() {
  const res = await fetch('http://localhost:3100/api/factory/dialogue-templates');
  if (!res.ok) throw new Error('Errore nel recupero dei DataDialogueTemplates');
  return res.json();
}

// Translations services (factory DB)
export async function getIDETranslations() {
  const res = await fetch('http://localhost:3100/api/factory/ide-translations');
  if (!res.ok) throw new Error('Errore nel recupero di IDETranslations');
  return res.json();
}

export async function getDataDialogueTranslations() {
  const res = await fetch('http://localhost:3100/api/factory/data-dialogue-translations');
  if (!res.ok) throw new Error('Errore nel recupero di DataDialogueTranslations');
  return res.json();
}

export async function saveDataDialogueTranslations(payload: Record<string, string>) {
  const res = await fetch('http://localhost:3100/api/factory/data-dialogue-translations', {
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
          label: item.label || item.name || item.discursive || item.shortLabel || 'Unnamed',
          shortLabel: item.shortLabel || item.label || item.name || item.discursive || '',
          name: item.name || item.label || item.shortLabel || item.discursive || '',
          description: item.description || item.discursive || item.label || item.name || '',
          category: category.name,
          categoryType: typedEntityType,
          iconComponent: undefined, // solo riferimento al componente
          color,
          userActs: item.userActs,
          uiColor: undefined // o la tua logica per il colore di sfondo
        });
      });
    });
  });
  
  return intellisenseItems;
};