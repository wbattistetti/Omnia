import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateStructureFromAI, generateTaskStructureFromAI } from '../taskOrchestrator';
import type { SchemaNode } from '../../components/TaskTreeBuilder/TaskTreeWizard/types';

// Mock callAIInference
vi.mock('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference', () => ({
  callAIInference: vi.fn()
}));

describe('taskOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateStructureFromAI', () => {
    it('should handle schema.mainData format (new backend format)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              {
                label: 'Date of Birth',
                type: 'date',
                subData: [
                  { label: 'Day', type: 'number' },
                  { label: 'Month', type: 'number' },
                  { label: 'Year', type: 'number' }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Chiedi data di nascita', 'groq');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        label: 'Date of Birth',
        type: 'date',
        constraints: []
      });
      expect(result[0].subTasks).toHaveLength(3);
      expect(result[0].subTasks[0]).toMatchObject({
        label: 'Day',
        type: 'number',
        constraints: []
      });
    });

    it('should handle schema.data format (old format for backward compatibility)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            data: [
              {
                label: 'Email',
                type: 'email',
                subTasks: [
                  { label: 'Username', type: 'text' },
                  { label: 'Domain', type: 'text' }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Chiedi email', 'groq');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        label: 'Email',
        type: 'email',
        constraints: []
      });
      expect(result[0].subTasks).toHaveLength(2);
    });

    it('should handle subData field in mainData (new format)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              {
                label: 'Phone Number',
                type: 'phone',
                subData: [
                  { label: 'Country Code', type: 'text' },
                  { label: 'Number', type: 'text' }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Chiedi numero di telefono', 'groq');

      expect(result[0].subTasks).toHaveLength(2);
      expect(result[0].subTasks[0].label).toBe('Country Code');
    });

    it('should handle subTasks field in mainData (old format)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              {
                label: 'Address',
                type: 'address',
                subTasks: [
                  { label: 'Street', type: 'text' },
                  { label: 'City', type: 'text' }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Chiedi indirizzo', 'groq');

      expect(result[0].subTasks).toHaveLength(2);
      expect(result[0].subTasks[0].label).toBe('Street');
    });

    it('should throw error if AI call returns null', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      vi.mocked(callAIInference).mockResolvedValue(null);

      await expect(
        generateStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI call failed o restituito null');
    });

    it('should throw error if schema is missing', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          // No schema field
          type: 'text',
          icon: 'FileText'
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await expect(
        generateStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI non ha restituito struttura dati valida');
    });

    it('should throw error if mainData and data are both missing', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            // No mainData or data
            label: 'Data'
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await expect(
        generateStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI non ha restituito struttura dati valida');
    });

    it('should throw error if mainData/data is empty array', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: []
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await expect(
        generateStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI non ha restituito struttura dati valida');
    });

    it('should throw error if mainData/data is not an array', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: { notAnArray: true }
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await expect(
        generateStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI non ha restituito struttura dati valida');
    });

    it('should use default model when model is not provided (groq)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [{ label: 'Test', type: 'text' }]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await generateStructureFromAI('Test label', 'groq');

      expect(callAIInference).toHaveBeenCalledWith(
        'Test label',
        'groq',
        'llama-3.1-70b-versatile'
      );
    });

    it('should use default model when model is not provided (openai)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [{ label: 'Test', type: 'text' }]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await generateStructureFromAI('Test label', 'openai');

      expect(callAIInference).toHaveBeenCalledWith(
        'Test label',
        'openai',
        'gpt-4-turbo-preview'
      );
    });

    it('should use provided model when model is specified', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [{ label: 'Test', type: 'text' }]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      await generateStructureFromAI('Test label', 'groq', 'custom-model');

      expect(callAIInference).toHaveBeenCalledWith(
        'Test label',
        'groq',
        'custom-model'
      );
    });

    it('should handle response without ai wrapper (direct result)', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        // No 'ai' wrapper, direct schema
        schema: {
          mainData: [
            { label: 'Direct Result', type: 'text' }
          ]
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Test label', 'groq');

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Direct Result');
    });

    it('should provide default values for missing fields', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              {
                // Missing label, type, constraints
                subData: [
                  { /* missing fields */ }
                ]
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Test label', 'groq');

      expect(result[0].label).toBe('Field');
      expect(result[0].type).toBe('text');
      expect(result[0].constraints).toEqual([]);
      expect(result[0].subTasks[0].label).toBe('Field');
      expect(result[0].subTasks[0].type).toBe('text');
    });

    it('should handle name field as alternative to label', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              {
                name: 'Field Name', // Using 'name' instead of 'label'
                type: 'text'
              }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateStructureFromAI('Test label', 'groq');

      expect(result[0].label).toBe('Field Name');
    });
  });

  describe('generateTaskStructureFromAI', () => {
    it('should call generateStructureFromAI and return nodes', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      const mockResponse = {
        ai: {
          schema: {
            mainData: [
              { label: 'Test Field', type: 'text' }
            ]
          }
        }
      };

      vi.mocked(callAIInference).mockResolvedValue(mockResponse);

      const result = await generateTaskStructureFromAI('Test label', 'groq');

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Test Field');
    });

    it('should propagate errors from generateStructureFromAI', async () => {
      const { callAIInference } = await import('../../components/TaskEditor/ResponseEditor/hooks/helpers/aiInference');

      vi.mocked(callAIInference).mockResolvedValue(null);

      await expect(
        generateTaskStructureFromAI('Test label', 'groq')
      ).rejects.toThrow('[taskOrchestrator] AI call failed o restituito null');
    });
  });
});
