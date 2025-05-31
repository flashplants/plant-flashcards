'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSyncedFilters } from '../hooks/useSyncedFilters';
import { applyFilters } from '../utils/filters';
import PlantFilterPanel from '../components/PlantFilterPanel';
import { Brain, ListChecks, Award, Clock, Leaf, GalleryHorizontalEnd } from 'lucide-react';

function QuizHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState([]);
  const [filters, setFilters] = useSyncedFilters(searchParams);
  const [answerStats, setAnswerStats] = useState({});
  const [favorites, setFavorites] = useState(new Set());
  const [collections, setCollections] = useState([]);
  const [showAdminCollections, setShowAdminCollections] = useState(true);
  const [globalSightings, setGlobalSightings] = useState({});
  const [userSightings, setUserSightings] = useState({});
  const [showAdminPlants, setShowAdminPlants] = useState(true);
  const [showAdminSightings, setShowAdminSightings] = useState(true);

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

  useEffect(() => {
    fetchPlants();
    if (user) {
      fetchAnswerStats();
      fetchFavorites();
      fetchCollections();
    }
  }, [user, showAdminCollections]);

  const fetchCollections = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const getCollectionPlantCount = (col) => {
    return filteredPlants.filter(plant => 
      plant.collection_plants?.some(cp => cp.collection_id === col.id)
    ).length;
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

  const getFavoritesCount = () => {
    return favorites.size;
  };

  const fetchPlants = async () => {
    try {
      const { data, error } = await supabase
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
        .eq('is_published', true);

      if (error) throw error;
      setPlants(data || []);

      // Fetch sightings for all plants
      if (data && data.length) {
        const allPlantIds = data.map(p => p.id);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quiz Hub</h1>
          <p className="mt-2 text-gray-600">Test your plant knowledge with different types of quizzes</p>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              onClick={() => router.push(`/plants?${searchParams.toString()}`)}
              className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
            >
              <Leaf className="h-4 w-4" />
              <span>View {filteredPlants.length} Plants in Database</span>
            </Button>
            <Button
              onClick={() => router.push(`/flashcards?${searchParams.toString()}`)}
              className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
            >
              <GalleryHorizontalEnd className="h-4 w-4" />
              <span>Study {filteredPlants.length} Plants with Flashcards</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filter Panel */}
          <div className="lg:col-span-1">
            <PlantFilterPanel
              user={user}
              plants={plants}
              filteredPlants={filteredPlants}
              collections={collections}
              filters={filters}
              setFilters={setFilters}
              showAdminSightings={showAdminSightings}
              showAdminCollections={showAdminCollections}
              showAdminPlants={showAdminPlants}
              getFavoritesCount={getFavoritesCount}
              getCollectionPlantCount={getCollectionPlantCount}
              needPracticeCount={Object.values(answerStats).filter(stats => 
                stats.total === 0 || stats.correct / stats.total < 0.8
              ).length}
            />
          </div>

          {/* Quiz Options */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Multiple Choice Quiz */}
              <Card className="hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <ListChecks className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Multiple Choice</h3>
                      <p className="text-sm text-gray-500">Test your knowledge with multiple choice questions</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>10 questions per quiz</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Award className="w-4 h-4" />
                      <span>Score based on accuracy</span>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={() => router.push(`/quiz/multiple-choice?${new URLSearchParams(filters).toString()}`)}
                    >
                      Start Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Coming Soon: Image Recognition Quiz */}
              <Card className="hover:shadow-lg transition-shadow duration-200 opacity-75">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Brain className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Image Recognition</h3>
                      <p className="text-sm text-gray-500">Identify plants from images</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Coming soon</span>
                    </div>
                    <Button 
                      className="w-full"
                      variant="outline"
                      disabled
                    >
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function QuizHubPage() {
  return <QuizHubContent />;
} 