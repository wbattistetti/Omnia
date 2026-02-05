// src/services/ProjectService.ts

import { ProjectData } from '../types/project';

const API = '';

/**
 * Retry a fetch request with exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
  timeout: number = 30000 // 30 second timeout for MongoDB queries
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeout)
      });

      if (response.ok) {
        return response;
      }

      // If it's a server error (5xx), retry
      if (response.status >= 500 && attempt < maxRetries - 1) {
        console.warn(`[ProjectService] Server error ${response.status}, retrying... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }

      // If it's a client error (4xx), don't retry
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a network error and we have retries left, retry
      if (attempt < maxRetries - 1) {
        console.warn(`[ProjectService] Network error, retrying... (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

export const ProjectService = {
  async getRecentProjects(): Promise<ProjectData[]> {
    try {
      console.log('[ProjectService] Fetching recent projects from /api/projects/catalog');
      const res = await fetchWithRetry(`/api/projects/catalog`, {}, 3, 1000, 30000);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ProjectService] Error fetching recent projects:', res.status, errorText);
        throw new Error(`Errore nel recupero progetti recenti: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn('[ProjectService] Response is not an array:', typeof data, data);
        return [];
      }
      console.log('[ProjectService] Loaded recent projects:', data.length);
      return data;
    } catch (error) {
      console.error('[ProjectService] Exception fetching recent projects:', error);
      // Check if backend is reachable
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[ProjectService] Backend might not be running or not reachable');
      }
      throw error;
    }
  },
  async getAllProjects(): Promise<ProjectData[]> {
    try {
      console.log('[ProjectService] Fetching all projects from /api/projects/catalog');
      const res = await fetchWithRetry(`/api/projects/catalog`, {}, 3, 1000, 30000);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ProjectService] Error fetching all projects:', res.status, errorText);
        throw new Error(`Errore nel recupero di tutti i progetti: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn('[ProjectService] Response is not an array:', typeof data, data);
        return [];
      }
      console.log('[ProjectService] Loaded all projects:', data.length);
      return data;
    } catch (error) {
      console.error('[ProjectService] Exception fetching all projects:', error);
      // Check if backend is reachable
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[ProjectService] Backend might not be running or not reachable');
      }
      throw error;
    }
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
    const res = await fetch(`/api/projects/catalog/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore nell\'eliminazione progetto');
  },
  async deleteAllProjects(): Promise<void> {
    const res = await fetch(`/api/projects/catalog`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Errore nell\'eliminazione di tutti i progetti');
  },
};