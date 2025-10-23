import { NLPConfigDB } from '../types';

export class DatabaseService {
  private db: any; // Will be replaced with real DB connection

  async getNLPConfig(): Promise<NLPConfigDB | null> {
    try {
      const response = await fetch('/api/nlp/config');
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Configuration not found
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[DatabaseService] Error fetching NLP config:', error);
      return null;
    }
  }

  async saveNLPConfig(config: NLPConfigDB): Promise<boolean> {
    try {
      const response = await fetch('/api/nlp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('[DatabaseService] Error saving NLP config:', error);
      return false;
    }
  }
}

export const databaseService = new DatabaseService();
