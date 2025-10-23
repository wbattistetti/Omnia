import { v4 as uuidv4 } from 'uuid';

/**
 * Unified ID generator for the entire frontend application
 * Ensures consistent ID format across all components and services
 */
export const generateId = (): string => {
    return uuidv4();
};

/**
 * Generates a shorter ID (24 chars) for compatibility with backend formats
 * while maintaining UUID uniqueness characteristics
 */
export const generateShortId = (): string => {
    return uuidv4().replace(/-/g, '').substring(0, 24);
};

/**
 * Validates if a string is a valid UUID format
 */
export const isValidId = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};
