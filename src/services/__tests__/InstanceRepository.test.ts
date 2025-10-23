import { describe, it, expect, beforeEach } from 'vitest';
import { instanceRepository } from '../InstanceRepository';
import type { ProblemIntent } from '../../types/project';

describe('InstanceRepository', () => {
    beforeEach(() => {
        // Pulisci il repository prima di ogni test
        instanceRepository.clearAll();
    });

    describe('createInstance', () => {
        it('should create a new instance with unique instanceId', () => {
            const actId = 'test-act-id';
            const instance = instanceRepository.createInstance(actId);

            expect(instance).toBeDefined();
            expect(instance.instanceId).toBeDefined();
            expect(instance.actId).toBe(actId);
            expect(instance.problemIntents).toEqual([]);
            expect(instance.createdAt).toBeInstanceOf(Date);
            expect(instance.updatedAt).toBeInstanceOf(Date);
        });

        it('should create instance with initial intents', () => {
            const actId = 'test-act-id';
            const initialIntents: ProblemIntent[] = [
                {
                    id: 'intent-1',
                    name: 'Intent 1',
                    threshold: 0.7,
                    phrases: {
                        matching: [],
                        notMatching: [],
                        keywords: []
                    }
                }
            ];

            const instance = instanceRepository.createInstance(actId, initialIntents);

            expect(instance.problemIntents).toEqual(initialIntents);
            expect(instance.problemIntents.length).toBe(1);
        });

        it('should create instances with unique IDs', () => {
            const instance1 = instanceRepository.createInstance('act-1');
            const instance2 = instanceRepository.createInstance('act-1');

            expect(instance1.instanceId).not.toBe(instance2.instanceId);
        });
    });

    describe('getInstance', () => {
        it('should retrieve an existing instance', () => {
            const instance = instanceRepository.createInstance('test-act');
            const retrieved = instanceRepository.getInstance(instance.instanceId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.instanceId).toBe(instance.instanceId);
            expect(retrieved?.actId).toBe('test-act');
        });

        it('should return undefined for non-existent instance', () => {
            const retrieved = instanceRepository.getInstance('non-existent-id');

            expect(retrieved).toBeUndefined();
        });
    });

    describe('updateIntents', () => {
        it('should update intents for existing instance', () => {
            const instance = instanceRepository.createInstance('test-act');
            const newIntents: ProblemIntent[] = [
                {
                    id: 'new-intent',
                    name: 'New Intent',
                    threshold: 0.8,
                    phrases: {
                        matching: [],
                        notMatching: [],
                        keywords: []
                    }
                }
            ];

            const result = instanceRepository.updateIntents(instance.instanceId, newIntents);

            expect(result).toBe(true);

            const updated = instanceRepository.getInstance(instance.instanceId);
            expect(updated?.problemIntents).toEqual(newIntents);
            expect(updated?.updatedAt.getTime()).toBeGreaterThan(instance.updatedAt.getTime());
        });

        it('should return false for non-existent instance', () => {
            const result = instanceRepository.updateIntents('non-existent', []);

            expect(result).toBe(false);
        });
    });

    describe('deleteInstance', () => {
        it('should delete an existing instance', () => {
            const instance = instanceRepository.createInstance('test-act');

            const result = instanceRepository.deleteInstance(instance.instanceId);
            expect(result).toBe(true);

            const retrieved = instanceRepository.getInstance(instance.instanceId);
            expect(retrieved).toBeUndefined();
        });

        it('should return false for non-existent instance', () => {
            const result = instanceRepository.deleteInstance('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('getAllInstances', () => {
        it('should return all instances', () => {
            instanceRepository.createInstance('act-1');
            instanceRepository.createInstance('act-2');
            instanceRepository.createInstance('act-3');

            const all = instanceRepository.getAllInstances();

            expect(all).toHaveLength(3);
        });

        it('should return empty array when no instances', () => {
            const all = instanceRepository.getAllInstances();

            expect(all).toEqual([]);
        });
    });

    describe('clearAll', () => {
        it('should clear all instances', () => {
            instanceRepository.createInstance('act-1');
            instanceRepository.createInstance('act-2');

            instanceRepository.clearAll();

            const all = instanceRepository.getAllInstances();
            expect(all).toEqual([]);
        });
    });
});

