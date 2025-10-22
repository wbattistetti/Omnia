import { NLPConfigDB } from './types';
import { databaseService } from './services/databaseService';

export class ConfigLoader {
  private config: NLPConfigDB | null = null;

  async load(): Promise<NLPConfigDB> {
    if (this.config) return this.config;
    
    try {
      const dbConfig = await databaseService.getNLPConfig();
      if (!dbConfig) {
        throw new Error('NLP configuration not found in database. Please check database connection and ensure configuration is initialized.');
      }
      
      this.config = dbConfig;
      return this.config;
      
    } catch (error) {
      throw new Error(`Failed to load NLP configuration: ${error.message}. Please contact administrator.`);
    }
  }
}

export const configLoader = new ConfigLoader();
