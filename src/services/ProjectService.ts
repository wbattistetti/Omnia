// src/services/ProjectService.ts

import { ProjectData } from '../types/project';

const API = 'http://localhost:3100';

export const ProjectService = {
  async getRecentProjects(): Promise<ProjectData[]> {
    const res = await fetch(`${API}/projects`);
    if (!res.ok) throw new Error('Errore nel recupero progetti recenti');
    return await res.json();
  },
  async getAllProjects(): Promise<ProjectData[]> {
    const res = await fetch(`${API}/projects/all`);
    if (!res.ok) throw new Error('Errore nel recupero di tutti i progetti');
    return await res.json();
  },
  async getProjectByName(name: string): Promise<ProjectData | null> {
    const all = await this.getAllProjects();
    return all.find(p => p.name?.toLowerCase() === name.toLowerCase()) || null;
  },
  async saveProject(project: ProjectData): Promise<any> {
    const res = await fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error('Errore nel salvataggio progetto');
    return await res.json();
  },
  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore nell\'eliminazione progetto');
  },
  async deleteAllProjects(): Promise<void> {
    const res = await fetch(`${API}/projects`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore nell\'eliminazione di tutti i progetti');
  },
}; 