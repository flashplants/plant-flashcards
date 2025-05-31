'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSyncedFilters } from '../hooks/useSyncedFilters';
import { applyFilters } from '../utils/filters';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Star,
  Eye,
  Binoculars,
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
  ExternalLink,
  Leaf,
  CircleDashed,
  Info,
} from 'lucide-react';
import Header from '../components/Header';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabase';
import { Button } from "@/components/ui/button";
import { buildFullPlantName, renderPlantName } from '../utils/plantNameUtils';
import { Badge } from "@/components/ui/badge";
import PlantFilterPanel from '../components/PlantFilterPanel';
import { useRouter, useSearchParams } from 'next/navigation';
import { debounce } from 'lodash';

// Tooltip component (simple, inline for now)
function Tooltip({ text, children }) {
  return (
    <span className="relative group">
      {children}
      <span
        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 w-[30vw] max-w-[30vw] min-w-[8rem] whitespace-normal rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-800"
      >
        {text}
      </span>
    </span>
  );
}

function FlashcardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalSightings, setGlobalSightings] = useState([]);
  const [userSightings, setUserSightings] = useState([]);
  const [isFetchingUserData, setIsFetchingUserData] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [answered, setAnswered] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [collections, setCollections] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [incorrectPlants, setIncorrectPlants] = useState([]);
  const [studyAgainMode, setStudyAgainMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAdminPlants, setShowAdminPlants] = useState(true);
  const [showAdminCollections, setShowAdminCollections] = useState(true);
  const [showAdminSightings, setShowAdminSightings] = useState(true);

  const [filters, setFilters] = useSyncedFilters();

  // Filter plants based on current filters
  const filteredPlants = useMemo(() => {
    return applyFilters(plants, filters, { 
      favorites, 
      answered,
      globalSightings,
      userSightings
    });
  }, [plants, filters, favorites, answered, globalSightings, userSightings]);

  // Reset session when filters change
  useEffect(() => {
    setAnswered(new Set());
    setCurrentIndex(0);
  }, [filters]);

  // Add component mount logging
  useEffect(() => {
    console.log('PlantFlashcardApp component mounted');
  }, []);

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Memoize fetchUserData to prevent recreation on every render
  const fetchUserData = useCallback(async () => {
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
    } finally {
      setIsFetchingUserData(false);
    }
  }, [user, isFetchingUserData]);

  // Debounced version of fetchUserData
  const debouncedFetchUserData = useMemo(
    () => debounce(fetchUserData, 1000),
    [fetchUserData]
  );

  // Fetch collections regardless of authentication status
  useEffect(() => {
    console.log('=== COLLECTIONS FETCH START ===');
    const fetchCollections = async () => {
      try {
        console.log('Attempting to fetch collections...');
        const { data: collData, error } = await supabase
          .from('collections_with_count')
          .select('*')
          .eq('is_published', true)
          .order('name');
        
        console.log('=== COLLECTIONS DATA ===');
        console.log('Data:', collData);
        console.log('Error:', error);
        console.log('=== END COLLECTIONS DATA ===');

        if (error) {
          console.error('Error fetching collections:', error);
          return;
        }

        if (collData) {
          console.log('Setting collections:', collData);
          setCollections(collData);
        } else {
          console.log('No collections data returned');
        }
      } catch (error) {
        console.error('Error in fetchCollections:', error);
      }
    };

    fetchCollections();
  }, []);

  // Fetch plants only once on mount
  useEffect(() => {
    fetchPlants();
  }, []);

  // Fetch user data when user changes
  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('show_admin_plants, show_admin_collections, show_admin_sightings')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            if (typeof data.show_admin_plants === 'boolean') setShowAdminPlants(data.show_admin_plants);
            if (typeof data.show_admin_collections === 'boolean') setShowAdminCollections(data.show_admin_collections);
            if (typeof data.show_admin_sightings === 'boolean') setShowAdminSightings(data.show_admin_sightings);
          }
        });
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
          ),
          collection_plants (
            collection_id
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

      // Fetch global sightings
      const plantIds = plantsWithSightings.map(p => p.id);
      const { data: globalData } = await supabase
        .from('global_sighting_counts')
        .select('plant_id, sighting_count')
        .in('plant_id', plantIds);
      
      if (globalData) {
        const counts = {};
        globalData.forEach(row => {
          counts[row.plant_id] = row.sighting_count;
        });
        setGlobalSightings(counts);
      }

      // Fetch user sightings if authenticated
      if (user) {
        const { data: userData } = await supabase
          .from('sightings')
          .select('plant_id')
          .eq('user_id', user.id)
          .in('plant_id', plantIds);
        
        if (userData) {
          const counts = {};
          userData.forEach(row => {
            counts[row.plant_id] = (counts[row.plant_id] || 0) + 1;
          });
          setUserSightings(counts);
        }
      }
    } catch (err) {
      console.error('Error fetching plants:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

    const plant = filteredPlants[currentIndex];
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
    setCurrentIndex((prev) => (prev + 1) % filteredPlants.length);
  };

  const prevCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + filteredPlants.length) % filteredPlants.length);
  };

  const flipCard = () => {
    if (!showAnswer && user) {
      // Don't wait for the study session to complete
      recordStudySession(filteredPlants[currentIndex].id).catch(console.error);
    }
    setShowAnswer(!showAnswer);
  };

  const markAnswer = async (correct) => {
    if (!answered.has(currentIndex)) {
      setAnswered(prev => new Set([...prev, currentIndex]));
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
              plant_id: filteredPlants[currentIndex].id,
              is_correct: correct,
              session_id: sessionId
            });
        } catch (error) {
          console.error('Error recording answer:', error);
        }
      }

      // If this was incorrect, add to incorrect plants
      if (!correct) {
        setIncorrectPlants(prev => [...prev, filteredPlants[currentIndex]]);
      }

      // Check if this was the last card
      if (answered.size + 1 === filteredPlants.length) {
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
    const newPlants = shuffleArray(filteredPlants);
    setFilteredPlants(newPlants);
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
      // Use plant-images bucket for admin plants, user-plant-images for user plants
      const bucket = plant.is_admin_plant ? 'plant-images' : 'user-plant-images';
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${randomImage.path}`;
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

  // Helper functions for badge counts
  const getFavoritesCount = () => filteredPlants.filter(p => favorites.has(p.id)).length;
  const getMySightingsCount = () => filteredPlants.filter(p => p.sightings_count > 0).length;
  const getTestableCount = () => filteredPlants.filter(p => p.is_testable).length;
  const getNeedPracticeCount = () => filteredPlants.length; // Optionally, you can refine this if you want only those that need practice
  const getAllPlantsCount = () => filteredPlants.length;

  // Helper to get the correct plant count for a collection
  const getCollectionPlantCount = (col) => {
    if (typeof col.published_plant_count === 'number') return col.published_plant_count;
    return 0;
  };

  const handleViewPlants = () => {
    const search = searchParams.toString();
    router.push(`/plants${search ? `?${search}` : ''}`, { scroll: false });
  };

  if (loading) {
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
              setFilters({
                sightingsFilter: 'all',
                mySightingsFilter: null,
                favoritesOnly: false,
                testableOnly: false,
                needPractice: false,
                selectedCollection: null,
              });
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
          {!isFullscreen && (
            <>
              <div className="mb-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Flashcards</h1>
                    <p className="mt-2 text-gray-600">Test your plant knowledge</p>
                  </div>
                  <Button
                    onClick={handleViewPlants}
                    className="flex items-center gap-2"
                  >
                    <Leaf className="h-4 w-4" />
                    View {filteredPlants.length} Plants in Database
                  </Button>
                </div>
              </div>

              <PlantFilterPanel
                user={user}
                plants={filteredPlants.length > 0 ? filteredPlants : plants}
                filteredPlants={filteredPlants}
                collections={collections}
                filters={filters}
                setFilters={setFilters}
                showAdminSightings={showAdminSightings}
                showAdminCollections={showAdminCollections}
                showAdminPlants={showAdminPlants}
                getFavoritesCount={getFavoritesCount}
                getCollectionPlantCount={getCollectionPlantCount}
              />
            </>
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
                  disabled={isMobile}
                  className={`p-2 rounded-lg transition-colors ${
                    isMobile 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                  }`}
                  title={isMobile ? "Fullscreen mode is not available on mobile devices" : "Toggle fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
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

            {/* Navigation */}
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <button
                onClick={prevCard}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md text-sm sm:text-base"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              
              <button
                onClick={flipCard}
                className="px-3 sm:px-6 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg shadow hover:shadow-md text-sm sm:text-base"
              >
                {showAnswer ? 'Show Question' : 'Show Answer'}
              </button>

              <button
                onClick={nextCard}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white text-gray-700 rounded-lg shadow hover:shadow-md text-sm sm:text-base"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {showAnswer && !answered.has(currentIndex) && (
              <div className="flex justify-center gap-2 sm:gap-4 mt-4 sm:mt-6">
                <button
                  onClick={() => markAnswer(true)}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
                >
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>I knew it!</span>
                </button>
                <button
                  onClick={() => markAnswer(false)}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-1.5 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm sm:text-base"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>I didn't know</span>
                </button>
              </div>
            )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Study Session Summary</h2>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Total Cards:</span>
                <span className="font-semibold">{displayPlants.length}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Correct Answers:</span>
                <span className="font-semibold text-green-600">{stats.correct}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Incorrect Answers:</span>
                <span className="font-semibold text-red-600">{stats.incorrect}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Accuracy:</span>
                <span className="font-semibold">
                  {Math.round((stats.correct / displayPlants.length) * 100)}%
                </span>
              </div>
            </div>

            {incorrectPlants.length > 0 && (
              <div className="mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Plants to Review:</h3>
                <ul className="space-y-1 sm:space-y-2 max-h-[30vh] overflow-y-auto">
                  {incorrectPlants.map(plant => (
                    <li key={plant.id} className="text-sm sm:text-base text-gray-600">
                      {renderPlantName(plant)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-2 sm:gap-4">
              <button
                onClick={() => startNewSession(false)}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm sm:text-base"
              >
                New Session
              </button>
              {incorrectPlants.length > 0 && (
                <button
                  onClick={() => startNewSession(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
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

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FlashcardsContent />
    </Suspense>
  );
} 