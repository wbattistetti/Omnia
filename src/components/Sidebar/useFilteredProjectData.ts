import { useMemo, useState } from 'react';
import { EntityType } from '../../types/project';

export function useFilteredProjectData(data: any) {
  const [searchTerm, setSearchTerm] = useState('');

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