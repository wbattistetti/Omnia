// useFilteredProjectData.ts
// Custom React hook for filtering project data entities and categories by search term.
// Returns filtered data, current search term, and a setter for the search term.

import { useMemo, useState } from 'react';
import { EntityType } from '../../types/project';

/**
 * useFilteredProjectData
 * Custom hook to filter project data (entities and categories) based on a search term.
 * - Returns a filtered data structure matching the original, but only with categories/items that match the search.
 * - Exposes the current search term and a setter for controlled input.
 *
 * @param data - The full project data object (from context)
 * @returns { filteredData, searchTerm, setSearchTerm }
 */
export function useFilteredProjectData(data: any) {
  const [searchTerm, setSearchTerm] = useState('');

  // Memoize the filtered data to avoid unnecessary recalculations
  const filteredData: Record<string, any[]> = useMemo(() => {
    if (!searchTerm) return data as unknown as Record<string, any[]>;
    return Object.entries(data).reduce((acc, [entityType, categories]) => {
      const filteredCategories = (categories as any[]).filter((category: any) =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.items.some((item: any) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      if (filteredCategories.length > 0) {
        acc[entityType as EntityType] = filteredCategories;
      }
      return acc;
    }, {} as Record<string, any[]>);
  }, [data, searchTerm]);

  return { filteredData, searchTerm, setSearchTerm };
} 