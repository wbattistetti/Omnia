import { databaseService } from '../../../../nlp/services/databaseService';
import { NLPProfile } from '../DataExtractionEditor';

interface NLPConfigDB {
  supportedKinds: string[];
  aliases: Record<string, string>;
  extractorMapping: Record<string, string>;
  typeMetadata: Record<string, any>;
  aiPrompts: Record<string, any>;
  version: string;
  lastUpdated: string;
  permissions: { canEdit: boolean; canCreate: boolean; canDelete: boolean };
  auditLog: boolean;
}

/**
 * Save NLP profile configuration to global database
 */
export async function saveNLPProfileToGlobal(profile: NLPProfile): Promise<boolean> {
  try {
    const globalConfig: NLPConfigDB = {
      supportedKinds: [profile.kind],
      aliases: {},
      extractorMapping: { [profile.kind]: profile.kind },
      typeMetadata: {
        [profile.kind]: {
          description: profile.description || `Extractor for ${profile.kind}`,
          examples: profile.examples || [],
          regex: profile.regex ? [profile.regex] : undefined,
          testCases: profile.testCases || [], // 🆕 Save test cases
          // TODO: Add more fields from profile
        }
      },
      aiPrompts: {},  // Required field
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      permissions: { canEdit: true, canCreate: true, canDelete: false },
      auditLog: true
    };

    const success = await databaseService.saveNLPConfig(globalConfig);
    return success;
  } catch (error) {
    console.error('[NLP Profile Utils] Error saving to global:', error);
    throw error;
  }
}

