import { NLPConfigDB } from './types';

export class ConfigLoader {
  private config: NLPConfigDB | null = null;

  async load(): Promise<NLPConfigDB> {
    if (this.config) return this.config;
    
    // Mock configuration for testing - will be replaced with real database
    const mockConfig: NLPConfigDB = {
      supportedKinds: ["number", "email", "phone", "date", "generic"],
      aliases: { "age": "number", "mail": "email" },
      extractorMapping: { "number": "number", "email": "email", "generic": "generic" },
      typeMetadata: {
        "number": {
          description: "Integer or decimal number",
          examples: ["42", "3.14"],
          validators: [{ type: "number", reason: "Must be valid number" }]
        }
      }
    };
    
    this.config = mockConfig;
    return this.config;
  }
}

export const configLoader = new ConfigLoader();
