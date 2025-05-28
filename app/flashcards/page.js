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
import { buildFullPlantName, renderPlantName } from '../utils/plantNameUtils';

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
  const [sessionId, setSessionId] = useState(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [incorrectPlants, setIncorrectPlants] = useState([]);
  const [studyAgainMode, setStudyAgainMode] = useState(false);
  const [needPractice, setNeedPractice] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mySightingsOnly, setMySightingsOnly] = useState(false);
  const [testableOnly, setTestableOnly] = useState(false);

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

  // Refactored composable filtering logic
  useEffect(() => {
    if (plants.length === 0) return;

    const applyFilters = async () => {
      setIsFiltering(true);
      try {
        let filtered = [...plants];

        // 1. Collection filter
        if (selectedCollection) {
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
            .eq('collection_id', selectedCollection)
            .eq('plants.is_published', true);
          if (error) throw error;
          filtered = (data || [])
            .map(cp => cp.plants)
            .filter(Boolean);
        }

        // 2. Sightings filter
        if (sightingsFilter !== 'all') {
          const minSightings = parseInt(sightingsFilter);
          filtered = filtered.filter(plant => {
            const sightingsCount = plant.global_sighting_counts?.[0]?.sighting_count || 0;
            return sightingsCount >= minSightings;
          });
        }

        // 3. Favorites filter (toggle)
        if (favoritesOnly) {
          if (isAuthenticated) {
            filtered = filtered.filter(p => favorites.has(p.id));
          } else {
            setShowAuth(true);
            setFavoritesOnly(false);
            setIsFiltering(false);
            return;
          }
        }

        // 4. My Sightings filter (toggle)
        if (mySightingsOnly) {
          if (isAuthenticated) {
            const { data: sightingsData, error: sightingsError } = await supabase
              .from('sightings')
              .select('plant_id')
              .eq('user_id', user.id);
            if (sightingsError) {
              console.error('Sightings data error:', sightingsError);
              setFilteredPlants([]);
              setIsFiltering(false);
              return;
            }
            const sightingIds = (sightingsData || []).map(s => s.plant_id);
            filtered = filtered.filter(p => sightingIds.includes(p.id));
          } else {
            setShowAuth(true);
            setMySightingsOnly(false);
            setIsFiltering(false);
            return;
          }
        }

        // 5. Testable filter (toggle)
        if (testableOnly) {
          if (isAuthenticated) {
            const { data: testableData, error: testableError } = await supabase
              .from('sightings')
              .select('plant_id')
              .eq('user_id', user.id)
              .eq('is_testable', true);
            if (testableError) {
              console.error('Testable data error:', testableError);
              setFilteredPlants([]);
              setIsFiltering(false);
              return;
            }
            const testableIds = (testableData || []).map(s => s.plant_id);
            filtered = filtered.filter(p => testableIds.includes(p.id));
          } else {
            setShowAuth(true);
            setTestableOnly(false);
            setIsFiltering(false);
            return;
          }
        }

        // 6. Need Practice filter
        if (needPractice && user) {
          const { data: practiceData, error: practiceError } = await supabase
            .rpc('get_plants_needing_practice', {
              user_uuid: user.id,
              min_attempts: 3,
              success_threshold: 70.0,
              days_ago: 30
            });
          if (practiceError) {
            console.error('Practice data error:', practiceError);
            setFilteredPlants([]);
            setIsFiltering(false);
            return;
          }
          const practiceIds = (practiceData || []).map(p => p.plant_id);
          filtered = filtered.filter(p => practiceIds.includes(p.id));
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
  }, [selectedCollection, plants, isAuthenticated, sightingsFilter, needPractice, favoritesOnly, mySightingsOnly, testableOnly, favorites, user]);

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

  const fetchPlantsNeedingPractice = async () => {
    if (!user) return;
    
    try {
      console.log('Fetching plants needing practice for user:', user.id);
      
      // First, get the plants that need practice
      const { data: practiceData, error: practiceError } = await supabase
        .rpc('get_plants_needing_practice', {
          user_uuid: user.id,
          min_attempts: 3,
          success_threshold: 70.0,
          days_ago: 30
        });

      if (practiceError) {
        console.error('Practice data error:', practiceError);
        throw new Error(`Failed to fetch practice data: ${practiceError.message}`);
      }

      console.log('Practice data received:', practiceData);

      if (!practiceData || practiceData.length === 0) {
        console.log('No plants need practice');
        setFilteredPlants([]);
        return;
      }

      // Get the plant IDs from the practice data
      const plantIds = practiceData.map(p => p.plant_id);
      console.log('Plant IDs to fetch:', plantIds);

      // Fetch the full plant data
      const { data: plantsData, error: plantsError } = await supabase
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
        .in('id', plantIds)
        .eq('is_published', true);

      if (plantsError) {
        console.error('Plants data error:', plantsError);
        throw new Error(`Failed to fetch plant data: ${plantsError.message}`);
      }

      console.log('Plants data received:', plantsData);

      if (plantsData) {
        // Sort plants according to the order from get_plants_needing_practice
        const sortedPlants = plantIds.map(id => 
          plantsData.find(p => p.id === id)
        ).filter(Boolean);

        console.log('Sorted plants:', sortedPlants);
        setFilteredPlants(shuffleArray(sortedPlants));
      } else {
        console.log('No plant data received');
        setFilteredPlants([]);
      }
    } catch (error) {
      console.error('Error in fetchPlantsNeedingPractice:', error);
      setError(`Failed to load plants needing practice: ${error.message}`);
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

  const markAnswer = async (correct) => {
    if (!answered.has(currentIndex)) {
      setAnswered(new Set([...answered, currentIndex]));
      setStats(prev => ({
        ...prev,
        [correct ? 'correct' : 'incorrect']: prev[correct ? 'correct' : 'incorrect'] + 1
      }));

      // Record the answer in the database
      if (user && sessionId) {
        try {
          await supabase
            .from('flashcard_answers')
            .insert({
              user_id: user.id,
              plant_id: displayPlants[currentIndex].id,
              is_correct: correct,
              session_id: sessionId
            });
        } catch (error) {
          console.error('Error recording answer:', error);
        }
      }

      // If this was incorrect, add to incorrect plants
      if (!correct) {
        setIncorrectPlants(prev => [...prev, displayPlants[currentIndex]]);
      }

      // Check if this was the last card
      if (answered.size + 1 === displayPlants.length) {
        setTimeout(() => setShowSessionSummary(true), 300);
      } else {
        setTimeout(nextCard, 300);
      }
    }
  };

  const startNewSession = (useIncorrectOnly = false) => {
    setSessionId(crypto.randomUUID());
    setShowSessionSummary(false);
    setStats({ correct: 0, incorrect: 0 });
    setAnswered(new Set());
    setIncorrectPlants([]);
    
    if (useIncorrectOnly && incorrectPlants.length > 0) {
      setFilteredPlants(shuffleArray([...incorrectPlants]));
      setCurrentIndex(0);
    } else {
      resetSession();
    }
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

  // Initialize session ID when component mounts
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

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
                        setSelectedCollection(null);
                        setNeedPractice(false);
                        setFavoritesOnly(false);
                        setMySightingsOnly(false);
                        setTestableOnly(false);
                      }}
                      className={`px-3 py-1 rounded-md ${
                        !selectedCollection && !needPractice && !favoritesOnly && !mySightingsOnly && !testableOnly
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      All Plants ({plants.length})
                    </button>
                    {user && (
                      <>
                        <button
                          onClick={() => setFavoritesOnly((prev) => !prev)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            favoritesOnly
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          aria-pressed={favoritesOnly}
                        >
                          <Star className="w-4 h-4" />
                          Favorites ({favorites.size})
                        </button>
                        <button
                          onClick={() => setMySightingsOnly((prev) => !prev)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            mySightingsOnly
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          aria-pressed={mySightingsOnly}
                        >
                          <Eye className="w-4 h-4" />
                          My Sightings
                        </button>
                        <button
                          onClick={() => setTestableOnly((prev) => !prev)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            testableOnly
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          aria-pressed={testableOnly}
                        >
                          <Check className="w-4 h-4" />
                          Test Me
                        </button>
                        <button
                          onClick={() => setNeedPractice((prev) => !prev)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-md ${
                            needPractice
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          aria-pressed={needPractice}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Need Practice
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

      {/* Session Summary Modal */}
      {showSessionSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Study Session Summary</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cards:</span>
                <span className="font-semibold">{displayPlants.length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Correct Answers:</span>
                <span className="font-semibold text-green-600">{stats.correct}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Incorrect Answers:</span>
                <span className="font-semibold text-red-600">{stats.incorrect}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Accuracy:</span>
                <span className="font-semibold">
                  {Math.round((stats.correct / displayPlants.length) * 100)}%
                </span>
              </div>
            </div>

            {incorrectPlants.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Plants to Review:</h3>
                <ul className="space-y-2">
                  {incorrectPlants.map(plant => (
                    <li key={plant.id} className="text-gray-600">
                      {renderPlantName(plant)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => startNewSession(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                New Session
              </button>
              {incorrectPlants.length > 0 && (
                <button
                  onClick={() => startNewSession(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Study Incorrect Answers
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 