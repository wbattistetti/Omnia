import { NLPConfigDB } from './types';

export class ConfigLoader {
  private config: NLPConfigDB | null = null;

  async load(): Promise<NLPConfigDB> {
    if (this.config) return this.config;
    
    // Mock configuration for testing - will be replaced with real database
    const mockConfig: NLPConfigDB = {
      supportedKinds: ["number", "email", "phone", "date", "dateOfBirth", "generic"],
      aliases: { 
        "age": ["number"], 
        "mail": ["email"],
        "e-mail": ["email"],
        "telefono": ["phone"],
        "data": ["date", "dateOfBirth"]
      },
      extractorMapping: { 
        "number": "number", 
        "email": "email", 
        "phone": "phone",
        "date": "date",
        "dateOfBirth": "dateOfBirth",
        "generic": "generic" 
      },
      typeMetadata: {
        "number": {
          description: "Integer or decimal number",
          examples: ["42", "3.14", "100"],
          regex: ["\\d+(\\.\\d+)?"],
          validators: [{ type: "range", min: 0, max: 1000000, reason: "Must be positive number" }],
          llmPrompt: "Extract numeric values from text",
          constraints: ["positive"],
          defaultValue: 0,
          formatHint: "Enter a number"
        },
        "email": {
          description: "Email address",
          examples: ["test@example.com", "user@domain.it"],
          regex: ["[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"],
          validators: [{ type: "format", pattern: "email", reason: "Must be valid email format" }],
          llmPrompt: "Extract email addresses from text",
          constraints: ["format"],
          formatHint: "Enter email address"
        }
      },
      aiPrompts: {
        "suggestType": "Suggest the most appropriate data type based on the description",
        "generateValidator": "Generate validation rules for the specified data type"
      },
      version: "1.0.0",
      lastUpdated: "2025-01-15T10:00:00Z",
      permissions: {
        canEdit: true,
        canCreate: true,
        canDelete: false
      },
      auditLog: true
    };
    
    this.config = mockConfig;
    return this.config;
  }
}

export const configLoader = new ConfigLoader();
