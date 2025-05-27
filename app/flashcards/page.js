'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Star,
  Eye,
  EyeOff,
  Filter,
  User,
  LogIn,
  Image,
  File,
  Maximize2,
  Minimize2,
  ChevronDown,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Header from '../components/Header';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";

// Helper function to build full plant name
function buildFullPlantName(plant) {
  if (!plant) return '';

  // Build the name parts array
  let nameParts = [];
  
  // Add hybrid marker based on position (never italicized)
  if (plant.hybrid_marker === 'x') {
    if (plant.hybrid_marker_position === 'before_genus') {
      nameParts.push({ text: 'x', italic: false });
    }
  }
  
  // Add genus (italic)
  if (plant.genus) {
    nameParts.push({ text: plant.genus, italic: true });
  }
  
  // Add hybrid marker if it should be between genus and species (never italicized)
  if (plant.hybrid_marker === 'x' && plant.hybrid_marker_position === 'between_genus_species') {
    nameParts.push({ text: 'x', italic: false });
  }
  
  // Add specific epithet (italic)
  if (plant.specific_epithet) {
    nameParts.push({ text: plant.specific_epithet, italic: true });
  }

  // Add infraspecies rank and epithet if they exist
  if (plant.infraspecies_rank && plant.infraspecies_epithet) {
    // Convert subsp. to ssp.
    const rank = plant.infraspecies_rank === 'subsp.' ? 'ssp.' : plant.infraspecies_rank;
    nameParts.push({ text: rank, italic: false });
    nameParts.push({ text: plant.infraspecies_epithet, italic: true });
  }

  // Add variety if it exists
  if (plant.variety) {
    nameParts.push({ text: 'var.', italic: false });
    nameParts.push({ text: plant.variety, italic: true });
  }

  // Add cultivar with single quotes if it exists
  if (plant.cultivar) {
    nameParts.push({ text: `'${plant.cultivar}'`, italic: false });
  }

  // Build the final string with proper spacing and commas
  let result = [];
  
  // Add the scientific name parts with proper italicization
  let scientificNameParts = nameParts.map(part => {
    if (typeof part === 'string') {
      return part;
    }
    return part.italic ? `<i>${part.text}</i>` : part.text;
  });
  result.push({ text: scientificNameParts.join(' '), italic: false });

  // Add common name if it exists
  if (plant.common_name) {
    result.push(plant.common_name);
  }

  // Add family if it exists
  if (plant.family) {
    result.push({ text: plant.family, italic: true });
  }

  return result;
}

// Helper function to render plant name
const renderPlantName = (plant) => {
  const parts = buildFullPlantName(plant);
  return parts.map((part, index) => (
    <span key={index}>
      {typeof part === 'string' ? (
        <>
          {part}
          {index < parts.length - 1 ? ',' : ''}
        </>
      ) : (
        <>
          <span dangerouslySetInnerHTML={{ __html: part.italic ? `<i>${part.text}</i>` : part.text }} />
          {index < parts.length - 1 ? ',' : ''}
        </>
      )}
      {index < parts.length - 1 ? ' ' : ''}
    </span>
  ));
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function PlantFlashcardApp() {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [answered, setAnswered] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [filterMode, setFilterMode] = useState('all');
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isFetchingUserData, setIsFetchingUserData] = useState(false);
  const [sightingsFilter, setSightingsFilter] = useState('all');
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  // Memoize fetchUserData to prevent recreation on every render
  const fetchUserData = async () => {
    if (!user || isFetchingUserData) return;
    
    setIsFetchingUserData(true);
    try {
      // Fetch user's favorites
      const { data: favData } = await supabase
        .from('favorites')
        .select('plant_id')
        .eq('user_id', user.id);
      
      if (favData) {
        setFavorites(new Set(favData.map(f => f.plant_id)));
      }

      // Fetch collections
      const { data: collData } = await supabase
        .from('collections')
        .select('*')
        .or(`user_id.eq.${user.id},is_published.eq.true`)
        .order('name');
      
      if (collData) {
        setCollections(collData);
      }
    } finally {
      setIsFetchingUserData(false);
    }
  };

  // Debounced version of fetchUserData
  const debouncedFetchUserData = useCallback(
    debounce(fetchUserData, 1000),
    [fetchUserData]
  );

  // Fetch plants only once on mount
  useEffect(() => {
    fetchPlants();
  }, []);

  // Update filtered plants when dependencies change
  useEffect(() => {
    if (plants.length === 0) return;

    const applyFilters = async () => {
      setIsFiltering(true);
      try {
        if (selectedCollection) {
          await fetchCollectionPlants(selectedCollection);
          return;
        }

        let filtered = [...plants];

        // Apply sightings filter first
        if (sightingsFilter !== 'all') {
          const minSightings = parseInt(sightingsFilter);
          filtered = filtered.filter(plant => {
            const sightingsCount = plant.global_sighting_counts?.[0]?.sighting_count || 0;
            return sightingsCount >= minSightings;
          });
        }

        // Then apply other filters
        switch (filterMode) {
          case 'favorites':
            if (isAuthenticated) {
              filtered = filtered.filter(p => favorites.has(p.id));
            } else {
              setShowAuth(true);
              setFilterMode('all');
              return;
            }
            break;
          case 'sightings':
            if (isAuthenticated) {
              await fetchUserSightings();
              return;
            } else {
              setShowAuth(true);
              setFilterMode('all');
              return;
            }
            break;
          case 'testable':
            if (isAuthenticated) {
              await fetchTestablePlants();
              return;
            } else {
              setShowAuth(true);
              setFilterMode('all');
              return;
            }
            break;
        }

        setFilteredPlants(filtered);
      } catch (error) {
        console.error('Error applying filters:', error);
        setError('Failed to apply filters');
      } finally {
        setIsFiltering(false);
      }
    };

    applyFilters();
  }, [filterMode, selectedCollection, plants, isAuthenticated, sightingsFilter]);

  // Separate effect for favorites to prevent unnecessary re-filtering
  useEffect(() => {
    if (filterMode === 'favorites' && isAuthenticated) {
      const filtered = plants.filter(p => favorites.has(p.id));
      setFilteredPlants(filtered);
    }
  }, [favorites, filterMode, isAuthenticated, plants]);

  // Fetch user data when user changes
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchPlants = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('plants')
        .select(`
          *,
          plant_images (
            id,
            path,
            is_primary
          ),
          global_sighting_counts (
            sighting_count
          )
        `)
        .eq('is_published', true)
        .order('scientific_name');

      const { data, error } = await query;

      if (error) throw error;
      
      // Add sightings count to each plant
      const plantsWithSightings = (data || []).map(plant => ({
        ...plant,
        sightings_count: plant.global_sighting_counts?.[0]?.sighting_count || 0
      }));
      
      setPlants(shuffleArray(plantsWithSightings));
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchCollectionPlants = async (collectionId) => {
    setIsFiltering(true);
    try {
      const { data, error } = await supabase
        .from('collection_plants')
        .select(`
          plant_id,
          plants (
            *,
            plant_images (
              id,
              path,
              is_primary
            ),
            global_sighting_counts (
              sighting_count
            )
          )
        `)
        .eq('collection_id', collectionId)
        .eq('plants.is_published', true);

      if (error) throw error;

      if (data) {
        // Safely process the plants data
        const collectionPlants = data
          .map(cp => {
            if (!cp.plants) return null;
            return {
              ...cp.plants,
              sightings_count: cp.plants.global_sighting_counts?.[0]?.sighting_count || 0
            };
          })
          .filter(Boolean);

        // Apply sightings filter if active
        let filtered = collectionPlants;
        if (sightingsFilter !== 'all') {
          const minSightings = parseInt(sightingsFilter);
          filtered = collectionPlants.filter(plant => 
            (plant.sightings_count || 0) >= minSightings
          );
        }

        setFilteredPlants(shuffleArray(filtered));
      }
    } catch (error) {
      console.error('Error fetching collection plants:', error);
      setError('Failed to load collection plants');
    } finally {
      setIsFiltering(false);
    }
  };

  const fetchUserSightings = async () => {
    const { data } = await supabase
      .from('sightings')
      .select(`
        plant_id,
        plants (
          *,
          plant_images (
            id,
            path,
            is_primary
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('plants.is_published', true);

    if (data) {
      const sightingPlants = data.map(s => s.plants).filter(Boolean);
      setFilteredPlants(shuffleArray(sightingPlants));
    }
  };

  const fetchTestablePlants = async () => {
    const { data } = await supabase
      .from('sightings')
      .select(`
        plant_id,
        plants (
          *,
          plant_images (
            id,
            path,
            is_primary
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_testable', true)
      .eq('plants.is_published', true);

    if (data) {
      const testPlants = data.map(s => s.plants).filter(Boolean);
      setFilteredPlants(shuffleArray(testPlants));
    }
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const toggleFavorite = async (e) => {
    // Prevent the click from propagating to the card
    e.stopPropagation();
    
    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }

    const plant = displayPlants[currentIndex];
    const isFavorite = favorites.has(plant.id);

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('plant_id', plant.id);
        
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(plant.id);
          return next;
        });
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, plant_id: plant.id });
        
        setFavorites(prev => new Set([...prev, plant.id]));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const recordStudySession = async (plantId) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .upsert({
          user_id: user.id,
          plant_id: plantId,
          count: 1
        }, {
          onConflict: 'user_id,plant_id',
          count: 'count + 1'
        })
        .select();

      if (error) {
        console.error('Error recording study session:', error.message);
        return;
      }

      if (!data) {
        console.error('No data returned from study session insert');
        return;
      }
    } catch (err) {
      console.error('Error in study session:', err.message);
    }
  };

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % displayPlants.length);
  };

  const prevCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + displayPlants.length) % displayPlants.length);
  };

  const flipCard = () => {
    if (!showAnswer && user) {
      // Don't wait for the study session to complete
      recordStudySession(displayPlants[currentIndex].id).catch(console.error);
    }
    setShowAnswer(!showAnswer);
  };

  const markAnswer = (correct) => {
    if (!answered.has(currentIndex)) {
      setAnswered(new Set([...answered, currentIndex]));
      setStats(prev => ({
        ...prev,
        [correct ? 'correct' : 'incorrect']: prev[correct ? 'correct' : 'incorrect'] + 1
      }));
    }
    setTimeout(nextCard, 300);
  };

  const resetSession = () => {
    const newPlants = shuffleArray(displayPlants);
    if (filterMode === 'all' && !selectedCollection) {
      setPlants(newPlants);
    } else {
      setFilteredPlants(newPlants);
    }
    setCurrentIndex(0);
    setShowAnswer(false);
    setStats({ correct: 0, incorrect: 0 });
    setAnswered(new Set());
  };

  const getImageUrl = (plant) => {
    if (!plant) return null;
    
    // Get all available images
    const images = plant.plant_images || [];
    if (images.length === 0) return plant.image_url || null;
    
    // Randomly select an image
    const randomImage = images[Math.floor(Math.random() * images.length)];
    
    if (randomImage?.path) {
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${randomImage.path}`;
    }
    return plant.image_url || null;
  };

  // Determine which plants to display
  const displayPlants = filteredPlants.length > 0 ? filteredPlants : plants;

  // Update current image URL when navigating between cards
  useEffect(() => {
    const currentPlant = displayPlants[currentIndex];
    if (currentPlant) {
      setCurrentImageUrl(getImageUrl(currentPlant));
    }
  }, [currentIndex, displayPlants]);

  // Add a function to get the count of plants for each sightings filter
  const getSightingsCount = (minSightings) => {
    if (minSightings === 'all') return plants.length;
    const minCount = parseInt(minSightings);
    return plants.filter(plant => {
      const sightingsCount = plant.global_sighting_counts?.[0]?.sighting_count || 0;
      return sightingsCount >= minCount;
    }).length;
  };

  // Add fullscreen toggle function
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const refreshImage = (e) => {
    // Prevent the click from propagating to the card
    e.stopPropagation();
    
    const currentPlant = displayPlants[currentIndex];
    if (currentPlant) {
      setCurrentImageUrl(getImageUrl(currentPlant));
    }
  };

  if (loading || isFiltering) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-green-800">Loading plants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Plants</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPlants}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (displayPlants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No plants found for current filter.</p>
          <button
            onClick={() => {
              setFilterMode('all');
              setSelectedCollection(null);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Show All Plants
          </button>
        </div>
      </div>
    );
  }

  const currentPlant = displayPlants[currentIndex];
  const progress = ((answered.size / displayPlants.length) * 100).toFixed(0);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16 ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {!isFullscreen && <Header />}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isFullscreen ? 'h-screen flex items-center justify-center' : ''}`}>
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)}
        />

        <div className={`max-w-4xl mx-auto ${isFullscreen ? 'w-full max-w-6xl' : ''}`}>
          {/* Filters */}
          {!isFullscreen && (
            <div className="mb-6 bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-700">Filters</span>
                </div>
                <ChevronDown 
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                    isFiltersExpanded ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
              
              <div className={`transition-all duration-300 ease-in-out ${
                isFiltersExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => {
                        setFilterMode('all');
                        setSelectedCollection(null);
                      }}
                      className={`px-3 py-1 rounded-md ${
                        filterMode === 'all' && !selectedCollection
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      All Plants ({plants.length})
                    </button>
                    {user && (
                      <>
                        <button
                          onClick={() => {
                            setFilterMode('favorites');
                            setSelectedCollection(null);
                          }}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            filterMode === 'favorites'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          <Star className="w-4 h-4" />
                          Favorites ({favorites.size})
                        </button>
                        <button
                          onClick={() => {
                            setFilterMode('sightings');
                            setSelectedCollection(null);
                          }}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            filterMode === 'sightings'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          My Sightings
                        </button>
                        <button
                          onClick={() => {
                            setFilterMode('testable');
                            setSelectedCollection(null);
                          }}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            filterMode === 'testable'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          Test Me
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Sightings Filter */}
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-gray-600" />
                    <div className="flex gap-2">
                      <Button
                        variant={sightingsFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSightingsFilter('all')}
                      >
                        All ({getSightingsCount('all')})
                      </Button>
                      <Button
                        variant={sightingsFilter === '1' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSightingsFilter('1')}
                      >
                        1+ ({getSightingsCount('1')})
                      </Button>
                      <Button
                        variant={sightingsFilter === '2' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSightingsFilter('2')}
                      >
                        2+ ({getSightingsCount('2')})
                      </Button>
                      <Button
                        variant={sightingsFilter === '3' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSightingsFilter('3')}
                      >
                        3+ ({getSightingsCount('3')})
                      </Button>
                    </div>
                  </div>
                  
                  {collections.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-600" />
                      <select
                        value={selectedCollection || ''}
                        onChange={(e) => {
                          setSelectedCollection(e.target.value || null);
                          setFilterMode('collection');
                        }}
                        className="flex-1 p-2 border rounded-md"
                      >
                        <option value="">Select a collection...</option>
                        {collections.map(col => (
                          <option key={col.id} value={col.id}>
                            {col.name} {col.user_id === user?.id && '(My Collection)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Flashcard */}
          <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 ${isFullscreen ? 'h-[90vh] flex flex-col' : 'min-h-[600px] flex flex-col'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                Card {currentIndex + 1} of {displayPlants.length}
              </span>
              <div className="flex items-center gap-2">
                {user && (
                  <button
                    onClick={toggleFavorite}
                    className={`p-2 rounded-lg transition-colors ${
                      favorites.has(currentPlant.id)
                        ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                        : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <Star className={`w-5 h-5 ${favorites.has(currentPlant.id) ? 'fill-current' : ''}`} />
                  </button>
                )}
                <button
                  onClick={refreshImage}
                  className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600"
                  title="Show different image"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <a
                  href={`/plants/${currentPlant.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-gray-600"
                  title="View plant details"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5 text-gray-600" />
                  ) : (
                    <Maximize2 className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div 
              className={`flex-1 flex items-center justify-center cursor-pointer ${
                isFullscreen 
                  ? 'h-[calc(90vh-8rem)]' 
                  : 'h-[calc(600px-8rem)]'
              }`}
              onClick={flipCard}
            >
              <div className="text-center w-full h-full flex items-center justify-center">
                {!showAnswer ? (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    {currentImageUrl ? (
                      <img
                        src={currentImageUrl}
                        alt="Plant"
                        className={`max-w-full object-contain rounded-lg shadow-md mx-auto ${
                          isFullscreen 
                            ? 'max-h-[calc(90vh-12rem)]' 
                            : 'max-h-[calc(600px-12rem)]'
                        }`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`flex items-center justify-center ${
                        isFullscreen 
                          ? 'h-[calc(90vh-12rem)]' 
                          : 'h-[calc(600px-12rem)]'
                      } bg-gray-50 rounded-lg`}>
                        <p className="text-gray-500">No image available</p>
                      </div>
                    )}
                    <p className="text-gray-500 mt-4">Click to reveal scientific name</p>
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    <div className={`overflow-y-auto px-4 ${
                      isFullscreen 
                        ? 'max-h-[calc(90vh-12rem)]' 
                        : 'max-h-[calc(600px-12rem)]'
                    }`}>
                      <h2 className={`font-bold text-green-700 mb-2 ${isFullscreen ? 'text-4xl' : 'text-2xl'}`}>
                        {renderPlantName(currentPlant)}
                      </h2>
                      <p className={`text-gray-600 mb-1 ${isFullscreen ? 'text-xl' : ''}`}>
                        Family: {currentPlant.family}
                      </p>
                      {currentPlant.native_to && (
                        <p className={`text-gray-600 mb-1 ${isFullscreen ? 'text-xl' : 'text-sm'}`}>
                          Native to: {currentPlant.native_to}
                        </p>
                      )}
                      {currentPlant.bloom_period && (
                        <p className={`text-gray-600 mb-1 ${isFullscreen ? 'text-xl' : 'text-sm'}`}>
                          Blooms: {currentPlant.bloom_period}
                        </p>
                      )}
                      {currentPlant.description && (
                        <p className={`text-gray-600 mt-4 max-w-md mx-auto ${isFullscreen ? 'text-xl' : 'text-sm'}`}>
                          {currentPlant.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showAnswer && !answered.has(currentIndex) && (
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => markAnswer(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Check className="w-5 h-5" />
                  I knew it!
                </button>
                <button
                  onClick={() => markAnswer(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <X className="w-5 h-5" />
                  I didn't know
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={prevCard}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            
            <button
              onClick={flipCard}
              className="px-6 py-2 bg-green-600 text-white rounded-lg shadow hover:shadow-md"
            >
              {showAnswer ? 'Show Question' : 'Show Answer'}
            </button>

            <button
              onClick={nextCard}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          {!isFullscreen && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Progress: {progress}%</span>
                <button
                  onClick={resetSession}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  <RotateCw className="w-4 h-4" />
                  Reset
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700">Correct: {stats.correct}</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="w-5 h-5 text-red-600" />
                  <span className="text-gray-700">Incorrect: {stats.incorrect}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {!isFullscreen && <Footer />}
    </div>
  );
} 