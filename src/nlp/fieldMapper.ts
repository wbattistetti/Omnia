import { configLoader } from './configLoader';

export async function mapFieldToExtractor(field: string): Promise<string> {
  const config = await configLoader.load();
  const kind = config.aliases[field] || field;
  return config.extractorMapping[kind] || 'generic';
}

// Test function
export async function testFieldMapping() {
  console.log('Testing field mapping:');
  console.log('age ->', await mapFieldToExtractor('age'));
  console.log('email ->', await mapFieldToExtractor('email'));
  console.log('unknown ->', await mapFieldToExtractor('unknown'));
}
