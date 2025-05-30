// app/page.js
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Leaf, LayoutDashboard } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabase';
import Footer from './components/Footer';

function PlantList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    // Show auth modal if we have a redirect parameter
    const redirectedFrom = searchParams.get('redirectedFrom');
    if (redirectedFrom && !user) {
      setShowAuth(true);
    }
  }, [searchParams, user]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // If we have a redirect and a user, redirect them
        const redirectedFrom = searchParams.get('redirectedFrom');
        if (redirectedFrom) {
          router.replace(redirectedFrom);
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartLearning = () => {
    if (user) {
      router.push('/flashcards');
    } else {
      setShowAuth(true);
    }
  };

  const handleManagePlants = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      setShowAuth(true);
    }
  };

  const handleAuthSuccess = async (user) => {
    setUser(user);
    setShowAuth(false);
    const redirectedFrom = searchParams.get('redirectedFrom');
    if (redirectedFrom) {
      router.replace(redirectedFrom);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-green-800 mb-6">
            Welcome to Plant Flashcards
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Learn about plants through interactive flashcards. Test your knowledge, track your progress, and build your botanical expertise.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link
                  href="/flashcards"
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
                >
                  <Leaf className="w-6 h-6" />
                  Start Learning
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-600 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium border border-green-200"
                >
                  <LayoutDashboard className="w-6 h-6" />
                  Manage Plants
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartLearning}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium"
                >
                  <Leaf className="w-6 h-6" />
                  Start Learning
                </button>
                <button
                  onClick={handleManagePlants}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-600 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium border border-green-200"
                >
                  <LayoutDashboard className="w-6 h-6" />
                  Manage Plants
                </button>
              </>
            )}
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-green-700 mb-2">Interactive Learning</h3>
              <p className="text-gray-600">Flip through flashcards and test your knowledge of plant identification.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-green-700 mb-2">Track Progress</h3>
              <p className="text-gray-600">Monitor your learning journey with detailed statistics and progress tracking.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-green-700 mb-2">Manage Collection</h3>
              <p className="text-gray-600">Add, edit, and organize your plant collection through the dashboard.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => {
          setShowAuth(false);
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    }>
      <PlantList />
    </Suspense>
  );
}