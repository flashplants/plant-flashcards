import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { parseFiltersFromUrl, serializeFiltersToUrl, defaultFilters } from '../utils/filters';

export function useSyncedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(defaultFilters);
  const isFirstLoad = useRef(true);

  // Initialize filters from URL on mount and when URL changes
  useEffect(() => {
    const search = searchParams.toString();
    const urlFilters = parseFiltersFromUrl(search);
    setFilters(urlFilters);
  }, [searchParams]);

  // Update URL when filters change
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    const newSearch = serializeFiltersToUrl(filters);
    const newUrl = `${pathname}${newSearch}`;
    
    // Use router.push instead of replace to maintain history
    router.push(newUrl, { scroll: false });
  }, [filters, router, pathname]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const urlFilters = parseFiltersFromUrl(window.location.search);
      setFilters(urlFilters);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateFilters = (updates) => {
    setFilters(prev => {
      const newFilters = { ...prev, ...updates };
      
      // Check if all filters are at their default values
      const isAllDefault = Object.entries(newFilters).every(([key, value]) => {
        // Skip isFiltersExpanded as it's not part of the URL
        if (key === 'isFiltersExpanded') return true;
        return value === defaultFilters[key];
      });

      // If all filters are default, return defaultFilters
      return isAllDefault ? defaultFilters : newFilters;
    });
  };

  return [filters, updateFilters];
} 