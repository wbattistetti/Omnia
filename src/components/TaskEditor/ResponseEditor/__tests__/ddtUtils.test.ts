import { describe, it, expect } from 'vitest';
import { getDDTIcon, getNodeByIndex, ordinalIt, buildDDTForUI, stepMeta } from '../ddtUtils';
import { render } from '@testing-library/react';

describe('ddtUtils', () => {
  describe('getDDTIcon', () => {
    it('should return FileText icon for null/undefined type', () => {
      const { container } = render(getDDTIcon(''));
      expect(container.firstChild).toHaveClass('w-5', 'h-5', 'text-fuchsia-100', 'mr-2');
    });

    it('should return Calendar icon for date type', () => {
      const { container } = render(getDDTIcon('date'));
      expect(container.firstChild).toHaveClass('w-5', 'h-5', 'text-fuchsia-100', 'mr-2');
    });

    it('should return Mail icon for email type', () => {
      const { container } = render(getDDTIcon('email'));
      expect(container.firstChild).toHaveClass('w-5', 'h-5', 'text-fuchsia-100', 'mr-2');
    });

    it('should return MapPin icon for address type', () => {
      const { container } = render(getDDTIcon('address'));
      expect(container.firstChild).toHaveClass('w-5', 'h-5', 'text-fuchsia-100', 'mr-2');
    });

    it('should return FileText icon for unknown type', () => {
      const { container } = render(getDDTIcon('unknown'));
      expect(container.firstChild).toHaveClass('w-5', 'h-5', 'text-fuchsia-100', 'mr-2');
    });

    it('should be case insensitive', () => {
      const { container: container1 } = render(getDDTIcon('DATE'));
      const { container: container2 } = render(getDDTIcon('date'));
      expect(container1.firstChild).toEqual(container2.firstChild);
    });
  });

  describe('getNodeByIndex', () => {
    const mockMainData = {
      steps: [{ type: 'start' }],
      subData: [
        { steps: [{ type: 'sub1' }] },
        { steps: [{ type: 'sub2' }] },
      ],
    };

    it('should return mainData when index is null', () => {
      const result = getNodeByIndex(mockMainData, null);
      expect(result).toBe(mockMainData);
    });

    it('should return mainData when index is undefined', () => {
      const result = getNodeByIndex(mockMainData, undefined as any);
      expect(result).toBe(mockMainData);
    });

    it('should return subData element when index is valid', () => {
      const result = getNodeByIndex(mockMainData, 0);
      expect(result).toBe(mockMainData.subData[0]);
    });

    it('should return mainData when index is out of bounds', () => {
      const result = getNodeByIndex(mockMainData, 999);
      expect(result).toBe(mockMainData);
    });

    it('should return mainData when subData is undefined', () => {
      const mainDataWithoutSubData = { steps: [{ type: 'start' }] };
      const result = getNodeByIndex(mainDataWithoutSubData, 0);
      expect(result).toBe(mainDataWithoutSubData);
    });
  });

  describe('ordinalIt', () => {
    it('should return 1° for 1', () => {
      expect(ordinalIt(1)).toBe('1°');
    });

    it('should return 2° for 2', () => {
      expect(ordinalIt(2)).toBe('2°');
    });

    it('should return 3° for 3', () => {
      expect(ordinalIt(3)).toBe('3°');
    });

    it('should return 4° for 4', () => {
      expect(ordinalIt(4)).toBe('4°');
    });

    it('should return 10° for 10', () => {
      expect(ordinalIt(10)).toBe('10°');
    });
  });

  describe('buildDDTForUI', () => {
    it('should return ddt as is when ddt is null', () => {
      const result = buildDDTForUI(null, {});
      expect(result).toBe(null);
    });

    it('should return ddt as is when ddt is undefined', () => {
      const result = buildDDTForUI(undefined, {});
      expect(result).toBe(undefined);
    });

    it('should build steps from selectedNode', () => {
      const mockDDT = { id: 'test', label: 'Test' };
      const mockSelectedNode = {
        steps: [
          {
            type: 'start',
            escalations: [
              { escalationId: 'esc1', actions: ['action1'] },
            ],
          },
        ],
      };

      const result = buildDDTForUI(mockDDT, mockSelectedNode);

      expect(result).toEqual({
        id: 'test',
        label: 'Test',
        steps: {
          start: [
            {
              type: 'escalation',
              id: 'esc1',
              actions: ['action1'],
            },
          ],
        },
      });
    });

    it('should handle selectedNode without steps', () => {
      const mockDDT = { id: 'test' };
      const mockSelectedNode = {};

      const result = buildDDTForUI(mockDDT, mockSelectedNode);

      expect(result).toEqual({
        id: 'test',
        steps: {},
      });
    });

    it('should handle steps without escalations', () => {
      const mockDDT = { id: 'test' };
      const mockSelectedNode = {
        steps: [
          { type: 'start', escalations: [] },
        ],
      };

      const result = buildDDTForUI(mockDDT, mockSelectedNode);

      expect(result).toEqual({
        id: 'test',
        steps: {
          start: [],
        },
      });
    });
  });

  describe('stepMeta', () => {
    it('should have all required step types', () => {
      const expectedSteps = ['start', 'noMatch', 'noInput', 'confirmation', 'success', 'notAcquired'];
      expectedSteps.forEach(step => {
        expect(stepMeta[step]).toBeDefined();
        expect(stepMeta[step].icon).toBeDefined();
        expect(stepMeta[step].label).toBeDefined();
        expect(stepMeta[step].border).toBeDefined();
        expect(stepMeta[step].bg).toBeDefined();
        expect(stepMeta[step].color).toBeDefined();
        expect(stepMeta[step].bgActive).toBeDefined();
      });
    });

    it('should have correct labels', () => {
      expect(stepMeta.start.label).toBe('Chiedo il dato');
      expect(stepMeta.noMatch.label).toBe('Non capisco');
      expect(stepMeta.noInput.label).toBe('Non sento');
      expect(stepMeta.confirmation.label).toBe('Devo confermare');
      expect(stepMeta.success.label).toBe('Ho capito!');
      expect(stepMeta.notAcquired.label).toBe('Dato non acquisito');
    });
  });
}); 