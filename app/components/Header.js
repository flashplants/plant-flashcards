'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutDashboard, Leaf, LogIn, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, signOut } = useAuth();
  
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
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force a reload to clear all state and context
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center">
              <Leaf className="h-8 w-8 text-green-600" />
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
              <Home className="w-4 h-4 mr-1" />
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
              <Leaf className="w-4 h-4 mr-1" />
              Flashcards
            </Link>

            {isAdmin && (
              <Link
                href="/dashboard"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  pathname === '/dashboard'
                    ? 'text-green-600 border-b-2 border-green-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-1" />
                Admin Dashboard
              </Link>
            )}
          </nav>

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
      />
    </header>
  );
} 