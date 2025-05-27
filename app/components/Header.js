// app/components/Header.js
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Leaf, LogIn, LogOut, GalleryHorizontalEnd, House, CircleGauge } from 'lucide-react';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, signOut, supabase } = useAuth();
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(profile?.is_admin || false);
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, supabase]);

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent double-clicks
    
    setIsSigningOut(true);
    try {
      await signOut();
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDashboardClick = (e) => {
    if (!isAdmin) {
      e.preventDefault();
      setShowAuth(true);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center">
              <Leaf className="w-5 h-5 text-green-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Plant Flashcards</span>
            </Link>
          </div>

          <nav className="flex space-x-8">
            <Link
              href="/"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                pathname === '/'
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <House className="w-4 h-4 mr-1" />
              Home
            </Link>

            <Link
              href="/flashcards"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                pathname === '/flashcards'
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GalleryHorizontalEnd className="w-4 h-4 mr-1" />
              Flashcards
            </Link>

            <Link
              href="/dashboard"
              onClick={handleDashboardClick}
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                pathname === '/dashboard'
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CircleGauge className="w-4 h-4 mr-1" />
              Admin Dashboard
            </Link>
          </nav>

          <div className="flex items-center">
            {user ? (
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M15 7a2 2 0 012 2m4 0a2 2 0 012-2m-4-4a2 2 0 00-2 2m4 0a2 2 0 002-2m-4-4a2 2 0 00-2 2m4 0a2 2 0 002-2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 12a9 9 0 1118 0 9 9 0 01-18 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
      />
    </header>
  );
}