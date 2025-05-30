'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "../../../components/ui/progress";
import { useSyncedFilters } from '../../hooks/useSyncedFilters';
import { applyFilters } from '../../utils/filters';
import { renderPlantName } from '../../utils/plantNameUtils';
import { Check, X, ArrowRight, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

function MultipleChoiceQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);
  const [plants, setPlants] = useState([]);
  const [filters, setFilters] = useSyncedFilters(searchParams);
  const [answerStats, setAnswerStats] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizPlants, setQuizPlants] = useState([]);
  const [options, setOptions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [globalSightings, setGlobalSightings] = useState({});
  const [userSightings, setUserSightings] = useState({});

  // Set filtersReady to true after the first render
  useEffect(() => {
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    fetchPlants();
    if (user) {
      fetchAnswerStats();
      fetchFavorites();
    }
    setSessionId(uuidv4());
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
          // Admins see both admin and their own plants
          query = query.or(`is_admin_plant.eq.true,user_id.eq.${user.id}`);
        } else {
          query = query.eq('is_admin_plant', true);
        }
        return query;
      };

      const { data, error } = await baseConditions(
        supabase
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
      );

      if (error) throw error;
      setPlants(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching plants:', error);
      setLoading(false);
    }
  };

  const fetchAnswerStats = async () => {
    try {
      const { data: answers, error } = await supabase
        .from('flashcard_answers')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

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
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('plant_id')
        .eq('user_id', user.id);
      if (error) throw error;
      setFavorites(new Set(data.map(fav => fav.plant_id)));
    } catch (error) {
      console.error('Error fetching favorites:', error);
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

  // After fetching plants, fetch sightings
  useEffect(() => {
    if (plants.length) {
      const plantIds = plants.map(p => p.id);
      fetchGlobalSightings(plantIds);
      if (user) fetchUserSightings(plantIds);
    }
  }, [plants, user]);

  const filteredPlants = useMemo(() => {
    return applyFilters(plants, filters, { favorites, answerStats, userSightings, globalSightings, user });
  }, [plants, filters, favorites, answerStats, userSightings, globalSightings, user]);

  useEffect(() => {
    if (filteredPlants.length > 0) {
      // Use all filtered plants if less than 10, otherwise pick 10 random
      const shuffled = [...filteredPlants].sort(() => 0.5 - Math.random());
      setQuizPlants(shuffled.slice(0, Math.min(10, shuffled.length)));
    }
  }, [filteredPlants]);

  useEffect(() => {
    if (quizPlants.length > 0 && currentQuestion < quizPlants.length) {
      generateOptions();
    }
  }, [currentQuestion, quizPlants]);

  const generateOptions = () => {
    const currentPlant = quizPlants[currentQuestion];
    // Use the full filteredPlants set for wrong answers
    const otherPlants = filteredPlants.filter(p => p.id !== currentPlant.id);
    const shuffled = [...otherPlants].sort(() => 0.5 - Math.random());
    const wrongOptions = shuffled.slice(0, 3);
    const allOptions = [...wrongOptions, currentPlant].sort(() => 0.5 - Math.random());
    setOptions(allOptions);
  };

  const handleAnswer = async (plantId) => {
    setSelectedAnswer(plantId);
    setShowResult(true);
    const isCorrect = plantId === quizPlants[currentQuestion].id;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    // Record answer in DB
    if (user && sessionId) {
      try {
        await supabase
          .from('flashcard_answers')
          .insert({
            user_id: user.id,
            plant_id: quizPlants[currentQuestion].id,
            is_correct: isCorrect,
            session_id: sessionId
          });
      } catch (err) {
        console.error('Error recording quiz answer:', err);
      }
    }
  };

  const handleNext = () => {
    if (currentQuestion < quizPlants.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    // Shuffle the current filteredPlants and pick up to 10 for the new quiz
    const shuffled = [...filteredPlants].sort(() => 0.5 - Math.random());
    setQuizPlants(shuffled.slice(0, Math.min(10, shuffled.length)));
  };

  const getImageUrl = (plant) => {
    if (!plant) return null;
    const images = plant.plant_images || [];
    if (images.length === 0) return plant.image_url || null;
    const randomImage = images[Math.floor(Math.random() * images.length)];
    if (randomImage?.path) {
      const bucket = plant.is_admin_plant ? 'plant-images' : 'user-plant-images';
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${randomImage.path}`;
    }
    return plant.image_url || null;
  };

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fullscreen toggle function
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

  if (!filtersReady || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (quizPlants.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">No Plants Available</h2>
              <p className="text-gray-600 mb-4">
                There are no plants available for the quiz with the current filters.
                Please adjust your filters and try again.
              </p>
              <Button onClick={() => router.push('/quiz')}>
                Back to Quiz Hub
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (currentQuestion >= quizPlants.length) {
    // Results message
    let resultMsg = '';
    const percent = (score / quizPlants.length) * 100;
    if (percent === 100) resultMsg = 'Perfect! You got them all right!';
    else if (percent >= 80) resultMsg = 'Great job!';
    else if (percent >= 50) resultMsg = 'Not bad! Keep practicing.';
    else resultMsg = 'Keep studying and try again!';

    return (
      <div className={`min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
        {!isFullscreen && <Header />}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="max-w-6xl mx-auto w-full">
            <div className="w-full flex flex-col items-center">
              <Card className="w-full max-w-4xl mx-auto">
                <CardContent className={`${isFullscreen ? 'p-12' : 'p-6'} px-2 sm:px-8`}>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Quiz Complete!</h2>
                  <p className="text-lg text-gray-700 mb-2 text-center">Your score: <span className="font-bold">{score} / {quizPlants.length}</span></p>
                  <p className="text-base text-gray-600 mb-6 text-center">{resultMsg}</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center mt-4 w-full">
                    <Button className="w-full sm:w-auto" onClick={handleRestart}>
                      <RotateCw className="w-4 h-4 mr-2" />
                      Take Another Quiz
                    </Button>
                    <Button className="w-full sm:w-auto" variant="outline" onClick={() => router.push('/quiz')}>
                      Back to Quiz Hub
                    </Button>
                    <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push(`/plants?${searchParams.toString()}`)}>
                      View Plants in Database
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
        {!isFullscreen && <Footer />}
      </div>
    );
  }

  const currentPlant = quizPlants[currentQuestion];

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-br from-green-50 to-emerald-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {!isFullscreen && <Header />}
      <main
        className={
          isFullscreen
            ? 'h-screen w-screen flex flex-col overflow-hidden'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20'
        }
        style={
          isFullscreen
            ? { minHeight: '100vh' }
            : { minHeight: 'calc(100vh - 8rem)' }
        }
      >
        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-8 mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Multiple Choice Quiz</h1>
                <p className="text-base sm:text-lg text-gray-600 mb-4">Question {currentQuestion + 1} of {quizPlants.length}</p>
              </div>
              <div className="flex items-center gap-2 mt-2 mb-2 w-full sm:w-auto">
                <button
                  onClick={isMobile ? undefined : toggleFullscreen}
                  disabled={isMobile}
                  aria-disabled={isMobile}
                  className={`p-2 rounded-lg transition-colors ${
                    isMobile 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                  }`}
                  title={isMobile ? "Fullscreen mode is not available on mobile devices" : "Toggle fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className={`w-5 h-5 ${isMobile ? 'text-gray-400' : ''}`} />
                  ) : (
                    <Maximize2 className={`w-5 h-5 ${isMobile ? 'text-gray-400' : ''}`} />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-2 mb-8 w-full max-w-4xl">
              <Progress value={(currentQuestion / quizPlants.length) * 100} />
            </div>
          </div>

          <div className="w-full flex flex-col items-center">
            <Card className="w-full max-w-4xl flex-1 flex flex-col justify-center">
              <CardContent className="flex-1 flex flex-col justify-center p-4 sm:p-8">
                <div className="flex justify-center mb-6 sm:mb-8" style={{ minHeight: '0' }}>
                  {getImageUrl(currentPlant) ? (
                    <img
                      src={getImageUrl(currentPlant)}
                      alt={renderPlantName(currentPlant)}
                      className="rounded-lg shadow object-contain bg-white w-full"
                      style={{ maxHeight: isFullscreen ? '50vh' : '40vh', maxWidth: '100%', width: 'auto' }}
                    />
                  ) : (
                    <div className={`flex items-center justify-center bg-gray-100 rounded-lg w-full ${isFullscreen ? 'h-[50vh]' : 'h-[40vh]'}`}>
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                </div>
                <h2 className="font-semibold text-gray-900 mb-6 text-center text-xl sm:text-2xl">
                  What is the scientific name of this plant?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {options.map((plant) => (
                    <Button
                      key={plant.id}
                      variant={selectedAnswer === plant.id ? "default" : "outline"}
                      className={`w-full h-auto py-2 px-4 text-left ${
                        showResult
                          ? plant.id === currentPlant.id
                            ? 'bg-green-100 border-green-500 text-green-900'
                            : selectedAnswer === plant.id
                            ? 'bg-red-100 border-red-500 text-red-900'
                            : ''
                          : ''
                      } ${isFullscreen ? 'text-lg' : ''}`}
                      onClick={() => !showResult && handleAnswer(plant.id)}
                      disabled={showResult}
                    >
                      <div className="flex flex-col items-start gap-2 w-full">
                        <div className="flex items-center gap-2">
                          {showResult && plant.id === currentPlant.id && (
                            <Check className="w-5 h-5 text-green-600" />
                          )}
                          {showResult && selectedAnswer === plant.id && plant.id !== currentPlant.id && (
                            <X className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <span className="whitespace-normal break-words text-left block w-full">{renderPlantName(plant)}</span>
                      </div>
                    </Button>
                  ))}
                </div>
                {showResult && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => {
                      if (currentQuestion < quizPlants.length - 1) {
                        handleNext();
                      } else {
                        setCurrentQuestion(currentQuestion + 1);
                      }
                    }}>
                      {currentQuestion < quizPlants.length - 1 ? (
                        <>
                          Next Question
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      ) : (
                        'Finish Quiz'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      {!isFullscreen && <Footer />}
    </div>
  );
}

export default function MultipleChoiceQuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    }>
      <MultipleChoiceQuizContent />
    </Suspense>
  );
}