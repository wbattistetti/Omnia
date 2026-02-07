// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { validateNodeStructure, validateTaskTreeStructure, DataStructureError } from '../validators';

describe('Validators - Strict Mode', () => {
  describe('validateNodeStructure', () => {
    it('should throw error if node uses _id instead of id', () => {
      const node = { _id: 'test', label: 'Test', subNodes: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('legacy \'_id\'');
    });

    it('should throw error if node uses subData', () => {
      const node = { id: 'test', label: 'Test', subData: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('legacy \'subData\'');
    });

    it('should throw error if node uses subSlots', () => {
      const node = { id: 'test', label: 'Test', subSlots: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('legacy \'subSlots\'');
    });

    it('should throw error if steps is array', () => {
      const node = { id: 'test', label: 'Test', steps: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('array');
    });

    it('should throw error if node uses name instead of label', () => {
      const node = { id: 'test', name: 'Test', subNodes: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('legacy \'name\'');
    });

    it('should throw error if node uses messages property', () => {
      const node = { id: 'test', label: 'Test', messages: {} };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('legacy \'messages\'');
    });

    it('should throw error if node is missing id', () => {
      const node = { label: 'Test', subNodes: [] };
      expect(() => validateNodeStructure(node)).toThrow(DataStructureError);
      expect(() => validateNodeStructure(node)).toThrow('missing \'id\'');
    });

    it('should validate correct node structure', () => {
      const node = { id: 'test', label: 'Test', subNodes: [], steps: {} };
      expect(() => validateNodeStructure(node)).not.toThrow();
    });

    it('should validate node with subNodes array', () => {
      const node = {
        id: 'test',
        label: 'Test',
        subNodes: [{ id: 'sub1', label: 'Sub1' }],
        steps: {}
      };
      expect(() => validateNodeStructure(node)).not.toThrow();
    });
  });

  describe('validateTaskTreeStructure', () => {
    it('should throw error if TaskTree uses data instead of nodes', () => {
      const taskTree = { id: 'test', data: [] };
      expect(() => validateTaskTreeStructure(taskTree)).toThrow(DataStructureError);
      expect(() => validateTaskTreeStructure(taskTree)).toThrow('legacy \'data\'');
    });

    it('should throw error if TaskTree.nodes is not an array', () => {
      const taskTree = { id: 'test', nodes: 'not-an-array' };
      expect(() => validateTaskTreeStructure(taskTree)).toThrow(DataStructureError);
      expect(() => validateTaskTreeStructure(taskTree)).toThrow('not an array');
    });

    it('should throw error if TaskTree.steps is array', () => {
      const taskTree = {
        id: 'test',
        nodes: [{ id: 'node1', label: 'Node1', subNodes: [] }],
        steps: []
      };
      expect(() => validateTaskTreeStructure(taskTree)).toThrow(DataStructureError);
      expect(() => validateTaskTreeStructure(taskTree)).toThrow('must be a dictionary');
    });

    it('should validate correct TaskTree structure', () => {
      const taskTree = {
        id: 'test',
        nodes: [
          { id: 'node1', label: 'Node1', subNodes: [], steps: {} }
        ],
        steps: {}
      };
      expect(() => validateTaskTreeStructure(taskTree)).not.toThrow();
    });

    it('should validate all nodes in TaskTree', () => {
      const taskTree = {
        id: 'test',
        nodes: [
          { id: 'node1', label: 'Node1', subNodes: [], steps: {} },
          { id: 'node2', label: 'Node2', subNodes: [], steps: {} }
        ],
        steps: {}
      };
      expect(() => validateTaskTreeStructure(taskTree)).not.toThrow();
    });

    it('should throw error if any node in TaskTree is invalid', () => {
      const taskTree = {
        id: 'test',
        nodes: [
          { id: 'node1', label: 'Node1', subNodes: [], steps: {} },
          { _id: 'node2', label: 'Node2', subNodes: [] } // Invalid: uses _id
        ],
        steps: {}
      };
      expect(() => validateTaskTreeStructure(taskTree)).toThrow(DataStructureError);
    });
  });
});
