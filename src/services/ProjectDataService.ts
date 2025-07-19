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
      name: item.name || item.nameDry || 'Unnamed Item',
      description: item.description || item.discursive || '',
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
      name: item.name || item.nameDry || 'Unnamed Item',
      description: item.description || item.discursive || ''
    });
  });
  return Object.values(categoriesMap);
};

// Helper per accesso type-safe a ProjectData
function getCategoriesByType(data: ProjectData, type: EntityType): Category[] {
  return (data as ProjectData)[type];
}

export const ProjectDataService = {
  async initializeProjectData(templateName: string, language: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const template = templateData[templateName as keyof typeof templateData];
    if (!template) {
      console.warn(`Template ${templateName} not found, using empty data`);
      projectData = {
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
    (projectData as ProjectData)[type].push(newCategory);
    return newCategory;
  },

  async deleteCategory(type: EntityType, categoryId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    (projectData as ProjectData)[type] = (projectData as ProjectData)[type].filter(c => c.id !== categoryId);
  },

  async updateCategory(type: EntityType, categoryId: string, updates: Partial<Category>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const category = (projectData as ProjectData)[type].find(c => c.id === categoryId);
    if (category) {
      Object.assign(category, updates);
    }
  },

  async addItem(type: EntityType, categoryId: string, name: string, description = ''): Promise<ProjectEntityItem> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const category = (projectData as ProjectData)[type].find(c => c.id === categoryId);
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
    const category = (projectData as ProjectData)[type].find(c => c.id === categoryId);
    if (category) {
      category.items = category.items.filter(i => i.id !== itemId);
    }
  },

  async updateItem(type: EntityType, categoryId: string, itemId: string, updates: Partial<ProjectEntityItem>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const category = (projectData as ProjectData)[type].find(c => c.id === categoryId);
    const item = category?.items.find(i => i.id === itemId);
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
    const color = SIDEBAR_TYPE_COLORS[entityType as EntityType]?.main;
    if (!Icon || !color) return;
    const typedEntityType = entityType as EntityType;
    const typedCategories: Category[] = (data as ProjectData)[typedEntityType];
    typedCategories.forEach((category: Category) => {
      category.items.forEach((item: any) => {
        intellisenseItems.push({
          id: `${entityType}-${category.id}-${item.id}`,
          name: item.name,
          description: item.discursive || item.description || item.name,
          category: category.name,
          categoryType: typedEntityType,
          iconComponent: Icon, // solo riferimento al componente
          color,
          userActs: item.userActs,
          uiColor: undefined // o la tua logica per il colore di sfondo
        });
      });
    });
  });
  
  return intellisenseItems;
};