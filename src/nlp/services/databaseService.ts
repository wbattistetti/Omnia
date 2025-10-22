import { NLPConfigDB } from '../types';

export class DatabaseService {
  private db: any; // Will be replaced with real DB connection

  async getNLPConfig(): Promise<NLPConfigDB | null> {
    // TODO: Implement real database query
    // For now, return null to simulate no database config
    return null;
  }

  async saveNLPConfig(config: NLPConfigDB): Promise<boolean> {
    // TODO: Implement real database save
    console.log('[DB] Would save config:', config.version);
    return true;
  }
}

export const databaseService = new DatabaseService();
