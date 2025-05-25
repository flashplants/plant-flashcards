// app/page.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  Check, 
  X, 
  Heart, 
  Eye,
  EyeOff,
  Filter,
  User,
  LogIn,
  Image as ImageIcon
} from 'lucide-react';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export default function PlantFlashcardApp() {
  const [plants, setPlants] = useState([]);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [answered, setAnswered] = useState(new Set());
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [filterMode, setFilterMode] = useState('all'); // all, favorites, sightings, testable
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    checkUser();
    fetchPlants();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [plants, filterMode, selectedCollection, favorites]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchUserData = async () => {
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
  };

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
          )
        `)
        .eq('is_published', true)
        .order('scientific_name');

      const { data, error } = await query;

      if (error) throw error;
      
      setPlants(shuffleArray(data || []));
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...plants];

    if (selectedCollection) {
      // Filter by collection
      fetchCollectionPlants(selectedCollection);
      return;
    }

    switch (filterMode) {
      case 'favorites':
        filtered = plants.filter(p => favorites.has(p.id));
        break;
      case 'sightings':
        if (user) {
          fetchUserSightings();
          return;
        }
        break;
      case 'testable':
        if (user) {
          fetchTestablePlants();
          return;
        }
        break;
    }

    setFilteredPlants(shuffleArray(filtered));
  };

  const fetchCollectionPlants = async (collectionId) => {
    const { data } = await supabase
      .from('collection_plants')
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
      .eq('collection_id', collectionId);

    if (data) {
      const collectionPlants = data.map(cp => cp.plants).filter(Boolean);
      setFilteredPlants(shuffleArray(collectionPlants));
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
      .eq('user_id', user.id);

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
      .eq('is_testable', true);

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

  const handleAuth = async (e) => {
    e.preventDefault();
    
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        console.log('Signup response:', data);
        alert('Check your email for confirmation!');
      } else {
        console.log('Attempting login with:', { email });
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) {
          console.error('Login error:', error);
          throw error;
        }
        console.log('Login successful:', data);
        setUser(data.user);
        setShowAuth(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFavorites(new Set());
  };

  const toggleFavorite = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    const plant = displayPlants[currentIndex];
    const isFavorite = favorites.has(plant.id);

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
  };

  const recordStudySession = async (plantId) => {
    if (!user) return;

    await supabase.rpc('increment_study_session', {
      p_user_id: user.id,
      p_plant_id: plantId
    });
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
      recordStudySession(displayPlants[currentIndex].id);
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
    const primaryImage = plant.plant_images?.find(img => img.is_primary);
    const anyImage = plant.plant_images?.[0];
    const image = primaryImage || anyImage;
    
    if (image?.path) {
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${image.path}`;
    }
    return plant.image_url || null;
  };

  // Determine which plants to display
  const displayPlants = filteredPlants.length > 0 ? filteredPlants : plants;

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
  const imageUrl = getImageUrl(currentPlant);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </h2>
            <form onSubmit={handleAuth}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded mb-3"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                required
              />
              <button
                type="submit"
                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>
            <p className="text-center mt-4 text-sm">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-green-600 hover:underline"
              >
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-800">Plant Flashcards</h1>
          <div className="flex gap-2">
            {user ? (
              <>
                <span className="text-sm text-gray-600 py-2 px-3">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  <User className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <LogIn className="w-5 h-5" />
                Login
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
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
                  <Heart className="w-4 h-4" />
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

        {/* Stats */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
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

        {/* Flashcard */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">
              Card {currentIndex + 1} of {displayPlants.length}
            </span>
            {user && (
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg transition-colors ${
                  favorites.has(currentPlant.id)
                    ? 'text-red-500 bg-red-50 hover:bg-red-100'
                    : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-5 h-5 ${favorites.has(currentPlant.id) ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          <div 
            className="min-h-[200px] flex items-center justify-center cursor-pointer"
            onClick={flipCard}
          >
            <div className="text-center w-full">
              {!showAnswer ? (
                <div>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Plant"
                      className="max-h-64 max-w-full object-contain rounded-lg shadow-md mx-auto"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <p className="text-gray-500">No image available</p>
                  )}
                  <p className="text-gray-500 mt-4">Click to reveal scientific name</p>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-green-700 mb-2">
                    {currentPlant.scientific_name}
                  </h2>
                  <p className="text-gray-600 mb-1">
                    Family: {currentPlant.family}
                  </p>
                  {currentPlant.native_to && (
                    <p className="text-gray-600 text-sm mb-1">
                      Native to: {currentPlant.native_to}
                    </p>
                  )}
                  {currentPlant.bloom_period && (
                    <p className="text-gray-600 text-sm mb-1">
                      Blooms: {currentPlant.bloom_period}
                    </p>
                  )}
                  {currentPlant.description && (
                    <p className="text-gray-600 text-sm mt-4 max-w-md mx-auto">
                      {currentPlant.description}
                    </p>
                  )}
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
        <div className="flex justify-between items-center">
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
      </div>
    </div>
  );
}