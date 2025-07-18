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
  agentActs: Category[];
  userActs: Category[];
  backendActions: Category[];
  conditions: Category[];
  tasks: Category[];
  macrotasks: Category[];
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
  userActs?: string[];
  categoryType?: EntityType;
  isNew?: boolean;
  bgColor?: string;
  textColor?: string;
}