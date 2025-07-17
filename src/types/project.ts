export type EntityType = 'agentActs' | 'userActs' | 'backendActions' | 'conditions' | 'tasks' | 'macrotasks';

export interface ProjectEntityItem {
  id: string;
  name: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  items: ProjectEntityItem[];
}

export interface ProjectData {
  [key in EntityType]: Category[];
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  template: string;
  language: string;
}

export interface NodeRowData {
  id: string;
  text: string;
  categoryType?: EntityType;
  isNew?: boolean;
}