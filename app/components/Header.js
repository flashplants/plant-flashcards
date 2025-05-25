'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutDashboard, Leaf, LogIn, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { supabase } from '../lib/supabase';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        // If we have a redirect, handle it
        const redirectedFrom = new URLSearchParams(window.location.search).get('redirectedFrom');
        if (redirectedFrom) {
          router.replace(redirectedFrom);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        if (pathname !== '/') {
          router.replace('/');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      // If we have a user and an intended destination, redirect there
      if (session?.user) {
        const redirectedFrom = new URLSearchParams(window.location.search).get('redirectedFrom');
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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (isLoading) {
    return (
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="text-xl font-bold text-green-600">Plant Flashcards</div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-green-600">
                Plant Flashcards
              </Link>
            </div>
            <nav className="ml-6 flex space-x-4">
              <Link
                href="/"
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === '/'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
              {user && (
                <>
                  <Link
                    href="/flashcards"
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === '/flashcards'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Leaf className="w-4 h-4 mr-2" />
                    Flashcards
                  </Link>
                  <Link
                    href="/dashboard"
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === '/dashboard'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center">
            {user ? (
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(user) => {
          setUser(user);
          setShowAuth(false);
          // If we have a redirect, handle it
          const redirectedFrom = new URLSearchParams(window.location.search).get('redirectedFrom');
          if (redirectedFrom) {
            router.replace(redirectedFrom);
          }
        }}
      />
    </header>
  );
} 