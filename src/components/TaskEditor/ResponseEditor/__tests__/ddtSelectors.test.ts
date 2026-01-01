import { describe, it, expect } from 'vitest';
import { getMainDataList, getSubDataList, getNodeSteps, getMessagesFor, findNode, getLabel, hasMultipleMains } from '../ddtSelectors';

import address from './__fixtures__/ddt_address.json';
import birthdate from './__fixtures__/ddt_birthdate.json';

describe('ddtSelectors', () => {
  describe('getMainDataList', () => {
    it('wrappa mainData singolo (root) in array', () => {
      const mains = getMainDataList(birthdate as any);
      expect(Array.isArray(mains)).toBe(true);
      expect(mains.length).toBe(1);
      expect(getLabel(mains[0])).toBe('Birthdate');
    });

    it('ritorna array di mainData quando mainData è array', () => {
      const mains = getMainDataList(address as any);
      expect(mains.length).toBe(2);
      expect(getLabel(mains[0])).toBe('Address');
      expect(getLabel(mains[1])).toBe('Contact');
    });
  });

  describe('getSubDataList', () => {
    it('ritorna subData del main', () => {
      const mains = getMainDataList(address as any);
      const subs = getSubDataList(mains[0]);
      expect(subs.map(getLabel)).toEqual(['street','city','postal_code','country']);
    });
  });

  describe('getNodeSteps', () => {
    it('estrae step da array steps[]', () => {
      const mains = getMainDataList(address as any);
      const steps = getNodeSteps(mains[0]);
      expect(steps).toEqual(['start','noInput','success']);
    });

    it('estrae step da oggetto steps{} o messages{}', () => {
      const mains = getMainDataList(address as any);
      const stepsContact = getNodeSteps(mains[1]);
      expect(stepsContact).toEqual(['success']);

      const rootSteps = getNodeSteps(birthdate as any);
      expect(rootSteps).toEqual(['start','noMatch','confirmation','success']);
    });
  });

  describe('getMessagesFor', () => {
    it('ritorna struttura step quando presente', () => {
      const mains = getMainDataList(address as any);
      const start = getMessagesFor(mains[0], 'start');
      expect(start).toHaveProperty('type', 'start');
    });

    it('ritorna {} quando non presente', () => {
      const mains = getMainDataList(address as any);
      const missing = getMessagesFor(mains[0], 'noMatch');
      expect(missing).toEqual({});
    });
  });

  describe('findNode & helpers', () => {
    it('seleziona main e sub con fallback sicuri', () => {
      const mains = getMainDataList(address as any);
      expect(getLabel(findNode(address as any, 0, null))).toBe('Address');
      expect(getLabel(findNode(address as any, 0, 2))).toBe('postal_code');
      // out of range fallback
      expect(getLabel(findNode(address as any, 10, null))).toBe('Address');
      expect(getLabel(findNode(address as any, 0, 99))).toBe('street');
    });

    it('hasMultipleMains', () => {
      expect(hasMultipleMains(address as any)).toBe(true);
      expect(hasMultipleMains(birthdate as any)).toBe(false);
    });
  });
});





