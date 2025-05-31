'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Card, CardContent } from "@/components/ui/card";
import { Award, Star, CircleDashed, Check, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { buildFullPlantName, renderPlantName } from '../utils/plantNameUtils';

function ProfileContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPlants: 0,
    masteredPlants: 0,
    needPracticePlants: 0,
    totalAttempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0
  });
  const [masteredPlants, setMasteredPlants] = useState([]);
  const [needPracticePlants, setNeedPracticePlants] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    fetchUserStats();
  }, [user, router]);

  const fetchUserStats = async () => {
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

      // Calculate mastery levels
      const mastered = [];
      const needPractice = [];
      plants?.forEach(plant => {
        const stats = plantStats[plant.id] || { correct: 0, total: 0 };
        if (stats.total >= 3 && stats.correct / stats.total >= 0.8) {
          mastered.push(plant);
        } else if (stats.total === 0 || stats.correct / stats.total < 0.8) {
          needPractice.push(plant);
        }
      });

      // Get recent activity
      const { data: recentAnswers } = await supabase
        .from('flashcard_answers')
        .select(`
          *,
          plants (
            id,
            scientific_name,
            common_name,
            family,
            genus,
            specific_epithet,
            infraspecies_rank,
            infraspecies_epithet,
            variety,
            cultivar,
            hybrid_marker,
            hybrid_marker_position
          )
        `)
        .eq('user_id', user.id)
        .order('answered_at', { ascending: false })
        .limit(10);

      setStats({
        totalPlants: plants?.length || 0,
        masteredPlants: mastered.length,
        needPracticePlants: needPractice.length,
        totalAttempts: answers?.length || 0,
        correctAnswers: answers?.filter(a => a.is_correct).length || 0,
        incorrectAnswers: answers?.filter(a => !a.is_correct).length || 0
      });
      setMasteredPlants(mastered);
      setNeedPracticePlants(needPractice);
      setRecentActivity(recentAnswers || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-2 text-gray-600">Track your learning progress</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Mastered Plants</h3>
                  <p className="text-2xl font-bold text-green-600">{stats.masteredPlants}</p>
                  <p className="text-sm text-gray-500">out of {stats.totalPlants} plants</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <CircleDashed className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Need Practice</h3>
                  <p className="text-2xl font-bold text-yellow-600">{stats.needPracticePlants}</p>
                  <p className="text-sm text-gray-500">plants to review</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Star className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Success Rate</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalAttempts > 0 
                      ? Math.round((stats.correctAnswers / stats.totalAttempts) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {stats.correctAnswers} correct out of {stats.totalAttempts} attempts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mastered Plants */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mastered Plants</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {masteredPlants.map(plant => (
              <Card key={plant.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900">{renderPlantName(plant)}</h3>
                  {plant.common_name && (
                    <p className="text-sm text-gray-600">{plant.common_name}</p>
                  )}
                  <p className="text-sm text-gray-500">{plant.family}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Need Practice Plants */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Need Practice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {needPracticePlants.map(plant => (
              <Card key={plant.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900">{renderPlantName(plant)}</h3>
                  {plant.common_name && (
                    <p className="text-sm text-gray-600">{plant.common_name}</p>
                  )}
                  <p className="text-sm text-gray-500">{plant.family}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map(activity => (
              <Card key={activity.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {renderPlantName(activity.plants)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.answered_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={activity.is_correct ? "success" : "destructive"}
                      className="flex items-center gap-1"
                    >
                      {activity.is_correct ? (
                        <>
                          <Check className="w-4 h-4" />
                          Correct
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          Incorrect
                        </>
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
} 