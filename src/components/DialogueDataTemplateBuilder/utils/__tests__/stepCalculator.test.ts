import { describe, it, expect } from 'vitest';
import { calculateTotalSteps, getStepDescription } from '../stepCalculator';

describe('stepCalculator', () => {
  describe('calculateTotalSteps', () => {
    it('should calculate steps for simple data node without subData', () => {
      const dataNode = { name: 'email' };
      const total = calculateTotalSteps(dataNode);
      
      // 5 × (1 + 0) = 5
      expect(total).toBe(5);
    });

    it('should calculate steps for data node with subData', () => {
      const dataNode = { 
        name: 'date of birth', 
        subData: ['day', 'month', 'year'] 
      };
      const total = calculateTotalSteps(dataNode);
      
      // 5 × (1 + 3) = 20
      expect(total).toBe(20);
    });

    it('should calculate steps for data node with empty subData array', () => {
      const dataNode = { 
        name: 'number', 
        subData: [] 
      };
      const total = calculateTotalSteps(dataNode);
      
      // 5 × (1 + 0) = 5
      expect(total).toBe(5);
    });

    it('should calculate steps for data node with complex subData', () => {
      const dataNode = { 
        name: 'address', 
        subData: ['street', 'city', 'postal_code', 'country'] 
      };
      const total = calculateTotalSteps(dataNode);
      
      // 5 × (1 + 4) = 25
      expect(total).toBe(25);
    });

    it('should handle data node without subData property', () => {
      const dataNode = { name: 'phone number' };
      const total = calculateTotalSteps(dataNode);
      
      // 5 × (1 + 0) = 5
      expect(total).toBe(5);
    });
  });

  describe('getStepDescription', () => {
    it('should return correct description for first step (detect type)', () => {
      const dataNode = { name: 'email' };
      const description = getStepDescription(1, dataNode);
      
      expect(description).toBe('Detecting data type for email');
    });

    it('should return correct description for mainData steps', () => {
      const dataNode = { name: 'email' };
      
      expect(getStepDescription(1, dataNode)).toBe('Detecting data type for email');
      expect(getStepDescription(2, dataNode)).toBe('Suggesting structure and constraints for email');
      expect(getStepDescription(3, dataNode)).toBe('Generating start prompt for email');
      expect(getStepDescription(4, dataNode)).toBe('Generating no match prompts for email');
      expect(getStepDescription(5, dataNode)).toBe('Generating success prompts for email');
    });

    it('should return correct descriptions for data with subData', () => {
      const dataNode = { 
        name: 'date of birth', 
        subData: ['day', 'month', 'year'] 
      };
      
      // MainData steps (1-5)
      expect(getStepDescription(1, dataNode)).toBe('Detecting data type for date of birth');
      expect(getStepDescription(5, dataNode)).toBe('Generating success prompts for date of birth');
      
      // SubData steps (6-20)
      expect(getStepDescription(6, dataNode)).toBe('Generating start prompt for day');
      expect(getStepDescription(10, dataNode)).toBe('Generating start prompt for month');
      expect(getStepDescription(15, dataNode)).toBe('Generating start prompt for year');
      expect(getStepDescription(20, dataNode)).toBe('Generating success prompts for year');
    });

    it('should return correct descriptions for complex subData', () => {
      const dataNode = { 
        name: 'address', 
        subData: ['street', 'city', 'postal_code', 'country'] 
      };
      
      // MainData steps (1-5)
      expect(getStepDescription(1, dataNode)).toBe('Detecting data type for address');
      expect(getStepDescription(5, dataNode)).toBe('Generating success prompts for address');
      
      // SubData steps (6-25)
      expect(getStepDescription(6, dataNode)).toBe('Generating start prompt for street');
      expect(getStepDescription(10, dataNode)).toBe('Generating start prompt for city');
      expect(getStepDescription(15, dataNode)).toBe('Generating start prompt for postal_code');
      expect(getStepDescription(20, dataNode)).toBe('Generating start prompt for country');
      expect(getStepDescription(25, dataNode)).toBe('Generating success prompts for country');
    });

    it('should return "Processing..." for invalid step numbers', () => {
      const dataNode = { name: 'email' };
      
      expect(getStepDescription(0, dataNode)).toBe('Processing...');
      expect(getStepDescription(10, dataNode)).toBe('Processing...');
      expect(getStepDescription(-1, dataNode)).toBe('Processing...');
    });

    it('should handle data node with empty subData array', () => {
      const dataNode = { 
        name: 'number', 
        subData: [] 
      };
      
      expect(getStepDescription(1, dataNode)).toBe('Detecting data type for number');
      expect(getStepDescription(5, dataNode)).toBe('Generating success prompts for number');
      expect(getStepDescription(6, dataNode)).toBe('Processing...');
    });

    it('should handle data node without subData property', () => {
      const dataNode = { name: 'phone number' };
      
      expect(getStepDescription(1, dataNode)).toBe('Detecting data type for phone number');
      expect(getStepDescription(5, dataNode)).toBe('Generating success prompts for phone number');
      expect(getStepDescription(6, dataNode)).toBe('Processing...');
    });
  });

  describe('integration tests', () => {
    it('should work correctly with real-world examples', () => {
      const testCases = [
        {
          dataNode: { name: 'email' },
          expectedSteps: 5,
          expectedDescriptions: [
            'Detecting data type for email',
            'Suggesting structure and constraints for email',
            'Generating start prompt for email',
            'Generating no match prompts for email',
            'Generating success prompts for email'
          ]
        },
        {
          dataNode: { name: 'date of birth', subData: ['day', 'month', 'year'] },
          expectedSteps: 20,
          expectedDescriptions: [
            'Detecting data type for date of birth',
            'Suggesting structure and constraints for date of birth',
            'Generating start prompt for date of birth',
            'Generating no match prompts for date of birth',
            'Generating success prompts for date of birth',
            'Generating start prompt for day',
            'Generating no match prompts for day',
            'Generating no input prompts for day',
            'Generating confirmation prompts for day',
            'Generating success prompts for day',
            'Generating start prompt for month',
            'Generating no match prompts for month',
            'Generating no input prompts for month',
            'Generating confirmation prompts for month',
            'Generating success prompts for month',
            'Generating start prompt for year',
            'Generating no match prompts for year',
            'Generating no input prompts for year',
            'Generating confirmation prompts for year',
            'Generating success prompts for year'
          ]
        },
        {
          dataNode: { name: 'address', subData: ['street', 'city', 'postal_code', 'country'] },
          expectedSteps: 25,
          expectedDescriptions: [
            'Detecting data type for address',
            'Suggesting structure and constraints for address',
            'Generating start prompt for address',
            'Generating no match prompts for address',
            'Generating success prompts for address',
            'Generating start prompt for street',
            'Generating no match prompts for street',
            'Generating no input prompts for street',
            'Generating confirmation prompts for street',
            'Generating success prompts for street',
            'Generating start prompt for city',
            'Generating no match prompts for city',
            'Generating no input prompts for city',
            'Generating confirmation prompts for city',
            'Generating success prompts for city',
            'Generating start prompt for postal_code',
            'Generating no match prompts for postal_code',
            'Generating no input prompts for postal_code',
            'Generating confirmation prompts for postal_code',
            'Generating success prompts for postal_code',
            'Generating start prompt for country',
            'Generating no match prompts for country',
            'Generating no input prompts for country',
            'Generating confirmation prompts for country',
            'Generating success prompts for country'
          ]
        }
      ];

      testCases.forEach(({ dataNode, expectedSteps, expectedDescriptions }) => {
        const totalSteps = calculateTotalSteps(dataNode);
        expect(totalSteps).toBe(expectedSteps);

        expectedDescriptions.forEach((expectedDescription, index) => {
          const description = getStepDescription(index + 1, dataNode);
          expect(description).toBe(expectedDescription);
        });
      });
    });
  });
}); 