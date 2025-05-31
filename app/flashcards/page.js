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
  Brain,
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
import { Progress } from "../../components/ui/progress";

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
  const [globalSightings, setGlobalSightings] = useState({});
  const [userSightings, setUserSightings] = useState({});
  const [isFetchingUserData, setIsFetchingUserData] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [answered, setAnswered] = useState(new Set());
  const [answerStats, setAnswerStats] = useState({});
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
  const [studySet, setStudySet] = useState([]);
  const [needPracticeCount, setNeedPracticeCount] = useState(0);

  const [filters, setFilters] = useSyncedFilters(searchParams);

  // Update need practice count when user changes
  useEffect(() => {
    if (user) {
      getNeedPracticeCount().then(setNeedPracticeCount);
    } else {
      setNeedPracticeCount(0);
    }
  }, [user]);

  // Filter plants based on current filters
  const filteredPlants = useMemo(() => {
    return applyFilters(plants, filters, { 
      favorites, 
      answered: answerStats,
      userSightings,
      globalSightings,
      showAdminPlants,
      user
    });
  }, [plants, filters, favorites, answerStats, userSightings, globalSightings, showAdminPlants, user]);

  // Update study set when filtered plants change
  useEffect(() => {
    setStudySet(shuffleArray([...filteredPlants]));
  }, [filteredPlants]);

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
    if (user) {
      supabase
        .from('profiles')
        .select('show_admin_collections')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data && typeof data.show_admin_collections === 'boolean') {
            setShowAdminCollections(data.show_admin_collections);
          }
        });
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('=== COLLECTIONS FETCH START ===');
      console.log('User:', user?.id);
      console.log('Show admin collections:', showAdminCollections);
      
      let query = supabase
        .from('collections')
        .select('id, name, is_published, is_admin_collection, user_id')
        .eq('is_published', true);

      // If user is logged in, show their collections and admin collections
      if (user) {
        query = query.or(`user_id.eq.${user.id},is_admin_collection.eq.true`);
      } else {
        query = query.eq('is_admin_collection', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log('Collections fetched:', data?.length);
      setCollections(data || []);
    };

    fetchPlants();
    if (user) {
      fetchAnswerStats();
      fetchFavorites();
      fetchData();
    }
  }, [user, showAdminCollections]);

  // Fetch plants only once on mount
  useEffect(() => {
    fetchPlants();
  }, []);

  // Fetch user data when user changes
  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchAnswerStats();
      fetchFavorites();
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
    try {
      // Get user's admin status first
      let isAdmin = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        isAdmin = profile?.is_admin || false;
      }

      // Build base query conditions
      const baseConditions = (query) => {
        query = query.eq('is_published', true);
        if (user) {
          if (isAdmin) {
            query = query.eq('is_admin_plant', true);
          } else {
            query = query.or(`is_admin_plant.eq.true,user_id.eq.${user.id}`);
          }
        } else {
          query = query.eq('is_admin_plant', true);
        }
        return query;
      };

      let allPlantsQuery = baseConditions(supabase
        .from('plants')
        .select(`
          *,
          plant_images (
            id,
            path,
            is_primary
          ),
          collection_plants (
            collection_id
          )
        `)
        .order('scientific_name'));

      const { data: allPlantsData, error: allPlantsError } = await allPlantsQuery;
      if (allPlantsError) throw allPlantsError;
      setPlants(allPlantsData || []);

      // Fetch sightings for all plants
      if (allPlantsData && allPlantsData.length) {
        const allPlantIds = allPlantsData.map(p => p.id);
        fetchGlobalSightings(allPlantIds);
        if (user) {
          fetchUserSightings(allPlantIds);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching plants:', error);
      setLoading(false);
    }
  };

  const fetchGlobalSightings = async (plantIds) => {
    if (!plantIds.length) return;
    const { data, error } = await supabase
      .from('global_sighting_counts')
      .select('plant_id, sighting_count')
      .in('plant_id', plantIds);
    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        counts[row.plant_id] = row.sighting_count;
      });
      setGlobalSightings(counts);
    }
  };

  const fetchUserSightings = async (plantIds) => {
    if (!plantIds.length || !user) return;
    const { data, error } = await supabase
      .from('sightings')
      .select('plant_id')
      .eq('user_id', user.id)
      .in('plant_id', plantIds);
    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        counts[row.plant_id] = (counts[row.plant_id] || 0) + 1;
      });
      setUserSightings(counts);
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

      // Update answer statistics
      const currentPlant = studySet[currentIndex];
      setAnswerStats(prev => {
        const plantStats = prev[currentPlant.id] || { correct: 0, total: 0 };
        return {
          ...prev,
          [currentPlant.id]: {
            correct: plantStats.correct + (correct ? 1 : 0),
            total: plantStats.total + 1
          }
        };
      });

      // Record the answer in the database
      if (user && sessionId) {
        try {
          await supabase
            .from('flashcard_answers')
            .insert({
              user_id: user.id,
              plant_id: currentPlant.id,
              is_correct: correct,
              session_id: sessionId
            });
        } catch (error) {
          console.error('Error recording answer:', error);
        }
      }

      // If this was incorrect, add to incorrect plants
      if (!correct) {
        setIncorrectPlants(prev => {
          const exists = prev.some(p => p.id === currentPlant.id);
          if (!exists) {
            return [...prev, currentPlant];
          }
          return prev;
        });
      }

      // Check if this was the last card
      if (answered.size + 1 === studySet.length) {
        setTimeout(() => setShowSessionSummary(true), 300);
      } else {
        setTimeout(nextCard, 300);
      }
    }
  };

  const startNewSession = (useIncorrectOnly = false) => {
    console.log('Starting new session:', { useIncorrectOnly, incorrectPlantsCount: incorrectPlants.length });
    setSessionId(crypto.randomUUID());
    setShowSessionSummary(false);
    setStats({ correct: 0, incorrect: 0 });
    setAnswered(new Set());
    
    if (useIncorrectOnly && incorrectPlants.length > 0) {
      console.log('Using incorrect plants:', incorrectPlants);
      // Use all incorrect plants from the previous session
      setStudySet(shuffleArray([...incorrectPlants]));
      setIncorrectPlants([]); // Clear incorrect plants for the new session
    } else {
      console.log('Using all filtered plants');
      setStudySet(shuffleArray([...filteredPlants]));
      setIncorrectPlants([]); // Clear incorrect plants for the new session
    }
    setCurrentIndex(0);
  };

  const resetSession = () => {
    setStudySet(shuffleArray([...filteredPlants]));
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

  // Update current image URL when navigating between cards
  useEffect(() => {
    const currentPlant = studySet[currentIndex];
    if (currentPlant) {
      setCurrentImageUrl(getImageUrl(currentPlant));
    }
  }, [currentIndex, studySet]);

  // Add a function to get the count of plants for each sightings filter
  const getSightingsCount = (minSightings) => {
    if (minSightings === 'all') return plants.length;
    const minCount = parseInt(minSightings);
    return plants.filter(plant => {
      const sightingsCount = globalSightings[plant.id] || 0;
      return sightingsCount >= minCount;
    }).length;
  };

  // Add a function to get the count of plants for each my sightings filter
  const getMySightingsCount = (minSightings) => {
    if (minSightings === 'all') return plants.length;
    const minCount = parseInt(minSightings);
    return plants.filter(plant => {
      const sightingsCount = userSightings[plant.id] || 0;
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
    
    const currentPlant = studySet[currentIndex];
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
  const getTestableCount = () => filteredPlants.filter(p => p.is_testable).length;
  const getNeedPracticeCount = async () => {
    if (!user) return 0;
    
    try {
      // Get all plants
      const { data: plants } = await supabase
        .from('plants')
        .select('*')
        .eq('is_published', true);

      // Get user's flashcard answers
      const { data: answers } = await supabase
        .from('flashcard_answers')
        .select('*')
        .eq('user_id', user.id);

      // Calculate statistics
      const plantStats = {};
      answers?.forEach(answer => {
        if (!plantStats[answer.plant_id]) {
          plantStats[answer.plant_id] = { correct: 0, total: 0 };
        }
        plantStats[answer.plant_id].total++;
        if (answer.is_correct) {
          plantStats[answer.plant_id].correct++;
        }
      });

      // Count plants needing practice (same logic as the filter)
      return plants?.filter(plant => {
        const stats = plantStats[plant.id] || { correct: 0, total: 0 };
        return stats.total === 0 || stats.correct / stats.total < 0.8;
      }).length || 0;
    } catch (error) {
      console.error('Error getting need practice count:', error);
      return 0;
    }
  };
  const getAllPlantsCount = () => filteredPlants.length;

  // Helper to get the correct plant count for a collection
  const getCollectionPlantCount = (col) => {
    return filteredPlants.filter(plant => 
      plant.collection_plants?.some(cp => cp.collection_id === col.id)
    ).length;
  };

  const handleViewPlants = () => {
    const search = searchParams.toString();
    router.push(`/plants${search ? `?${search}` : ''}`, { scroll: false });
  };

  const fetchAnswerStats = async () => {
    if (!user) return;
    
    try {
      // Get user's flashcard answers
      const { data: answers } = await supabase
        .from('flashcard_answers')
        .select('*')
        .eq('user_id', user.id);

      // Calculate statistics
      const stats = {};
      answers?.forEach(answer => {
        if (!stats[answer.plant_id]) {
          stats[answer.plant_id] = { correct: 0, total: 0 };
        }
        stats[answer.plant_id].total++;
        if (answer.is_correct) {
          stats[answer.plant_id].correct++;
        }
      });

      setAnswerStats(stats);
    } catch (error) {
      console.error('Error fetching answer stats:', error);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data: favData } = await supabase
        .from('favorites')
        .select('plant_id')
        .eq('user_id', user.id);
      
      if (favData) {
        setFavorites(new Set(favData.map(f => f.plant_id)));
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
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

  if (studySet.length === 0) {
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

  const currentPlant = studySet[currentIndex];
  const progress = ((answered.size / studySet.length) * 100).toFixed(0);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16 ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {!isFullscreen && <Header />}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isFullscreen ? 'h-screen flex items-center justify-center' : ''}`}>
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)}
        />

        <div className={`max-w-6xl mx-auto w-full ${isFullscreen ? 'max-w-6xl' : ''}`}>
          {!isFullscreen && (
            <>
              {/* Standardized Heading, Subheading, and Action Buttons */}
              <div className="mb-8 mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Flashcards</h1>
                    <p className="text-base sm:text-lg text-gray-600 mb-4">Test your plant knowledge</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-2 mb-2 w-full sm:w-auto">
                    <Button
                      onClick={handleViewPlants}
                      className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Leaf className="h-4 w-4" />
                      <span className="whitespace-nowrap">View {filteredPlants.length} Plants in Database</span>
                    </Button>
                    <Button
                      onClick={() => router.push(`/quiz?${searchParams.toString()}`)}
                      className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
                    >
                      <Brain className="h-4 w-4" />
                      <span>Quiz me on these {filteredPlants.length} plants</span>
                    </Button>
                  </div>
                </div>
              </div>

              <PlantFilterPanel
                filters={filters}
                setFilters={setFilters}
                plants={plants}
                answerStats={answerStats}
                needPracticeCount={needPracticeCount}
                user={user}
                filteredPlants={filteredPlants}
                getFavoritesCount={getFavoritesCount}
                collections={collections}
                getCollectionPlantCount={getCollectionPlantCount}
                showAdminCollections={showAdminCollections}
                showAdminSightings={showAdminSightings}
                showAdminPlants={showAdminPlants}
              />
            </>
          )}

          {/* Flashcard */}
          <div className={`bg-white rounded-xl shadow-lg p-8 mb-6 max-w-4xl mx-auto ${isFullscreen ? 'h-[90vh] flex flex-col' : 'min-h-[600px] flex flex-col'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">
                Card {currentIndex + 1} of {studySet.length}
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
              <Progress value={progress} className="mb-3" />
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
                <span className="font-semibold">{studySet.length}</span>
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
                  {Math.round((stats.correct / studySet.length) * 100)}%
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