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
  const [authRedirect, setAuthRedirect] = useState(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    // Check for redirect from middleware
    const redirectedFrom = searchParams.get('redirectedFrom');
    if (redirectedFrom) {
      setAuthRedirect(redirectedFrom);
      setShowAuth(true);
    }
  }, [searchParams]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
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
      setAuthRedirect('/flashcards');
      setShowAuth(true);
    }
  };

  const handleManagePlants = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      setAuthRedirect('/dashboard');
      setShowAuth(true);
    }
  };

  const handleAuthSuccess = async (user) => {
    setUser(user);
    setShowAuth(false);
    if (authRedirect) {
      router.push(authRedirect);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
            {searchParams.get('collection') ? 'Collection Plants' : 'All Plants'}
          </h1>
          {/* Plant list content will go here */}
        </div>
      </main>
      <Footer />
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => {
          setShowAuth(false);
          setAuthRedirect(null);
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