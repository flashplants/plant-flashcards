// Utility for plant/flashcard filters

export const defaultFilters = {
  favoritesOnly: false,
  testableOnly: false,
  needPractice: false,
  sightingsFilter: 'all',
  mySightingsFilter: null,
  selectedCollection: null,
  isFiltersExpanded: true,
};

export function applyFilters(plants, filters, { favorites, answered, userSightings, globalSightings } = {}) {
  let result = [...plants];
  
  // Collection filter
  if (filters.selectedCollection) {
    result = result.filter(plant => 
      plant.collection_plants?.some(cp => cp.collection_id === parseInt(filters.selectedCollection))
    );
  }

  // Favorites filter
  if (filters.favoritesOnly && favorites) {
    result = result.filter(p => favorites.has(p.id));
  }

  // Testable filter
  if (filters.testableOnly) {
    result = result.filter(p => p.is_testable);
  }

  // Need practice filter
  if (filters.needPractice && answered) {
    result = result.filter(plant => {
      const plantStats = answered[plant.id] || { correct: 0, total: 0 };
      return plantStats.total === 0 || plantStats.correct / plantStats.total < 0.8;
    });
  }

  // Sightings filter
  if (filters.sightingsFilter !== 'all') {
    const minSightings = parseInt(filters.sightingsFilter);
    result = result.filter(plant => {
      const count = globalSightings ? (globalSightings[plant.id] || 0) : 0;
      return count >= minSightings;
    });
  }

  // My sightings filter
  if (filters.mySightingsFilter) {
    const minSightings = parseInt(filters.mySightingsFilter);
    result = result.filter(plant => {
      const count = userSightings ? (userSightings[plant.id] || 0) : 0;
      return count >= minSightings;
    });
  }

  return result;
}

export function parseFiltersFromUrl(search) {
  if (!search || search === '?') return defaultFilters;
  
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const filters = { ...defaultFilters };
  
  // Parse all parameters that exist in the URL
  if (params.has('favorites')) filters.favoritesOnly = params.get('favorites') === 'true';
  if (params.has('testable')) filters.testableOnly = params.get('testable') === 'true';
  if (params.has('needPractice')) filters.needPractice = params.get('needPractice') === 'true';
  if (params.has('sightings')) filters.sightingsFilter = params.get('sightings');
  if (params.has('mySightings')) filters.mySightingsFilter = params.get('mySightings');
  if (params.has('collection')) filters.selectedCollection = params.get('collection');
  
  return filters;
}

export function serializeFiltersToUrl(filters) {
  const params = new URLSearchParams();
  
  // Only add parameters that differ from default values
  if (filters.favoritesOnly !== defaultFilters.favoritesOnly) {
    params.set('favorites', filters.favoritesOnly.toString());
  }
  if (filters.testableOnly !== defaultFilters.testableOnly) {
    params.set('testable', filters.testableOnly.toString());
  }
  if (filters.needPractice !== defaultFilters.needPractice) {
    params.set('needPractice', filters.needPractice.toString());
  }
  if (filters.sightingsFilter !== defaultFilters.sightingsFilter) {
    params.set('sightings', filters.sightingsFilter);
  }
  if (filters.mySightingsFilter !== defaultFilters.mySightingsFilter) {
    params.set('mySightings', filters.mySightingsFilter);
  }
  if (filters.selectedCollection !== defaultFilters.selectedCollection) {
    params.set('collection', filters.selectedCollection);
  }
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
} 