// app/components/Header.js
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Leaf, LogIn, LogOut, GalleryHorizontalEnd, House, CircleGauge, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
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

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <Link
              href="/"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <House className="w-5 h-5" />
              <span>Home</span>
            </Link>
            <Link
              href="/plants"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/plants'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <Leaf className="w-5 h-5" />
              <span>Plants</span>
            </Link>
            <Link
              href="/flashcards"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/flashcards'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <GalleryHorizontalEnd className="w-5 h-5" />
              <span>Flashcards</span>
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard"
                onClick={handleDashboardClick}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard'
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <CircleGauge className="w-5 h-5" />
                <span>Admin Dashboard</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>

            {/* Desktop auth button */}
            <div className="hidden md:block">
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
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:hidden`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={closeMobileMenu}
        />

        {/* Menu panel */}
        <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-lg">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-lg font-semibold">Menu</span>
              <button
                onClick={closeMobileMenu}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-4">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/'
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <House className="w-5 h-5" />
                <span>Home</span>
              </Link>
              <Link
                href="/plants"
                onClick={closeMobileMenu}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/plants'
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <Leaf className="w-5 h-5" />
                <span>Plants</span>
              </Link>
              <Link
                href="/flashcards"
                onClick={closeMobileMenu}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/flashcards'
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <GalleryHorizontalEnd className="w-5 h-5" />
                <span>Flashcards</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/dashboard"
                  onClick={(e) => {
                    closeMobileMenu();
                    handleDashboardClick(e);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/dashboard'
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <CircleGauge className="w-5 h-5" />
                  <span>Admin Dashboard</span>
                </Link>
              )}
            </nav>

            <div className="p-4 border-t">
              {user ? (
                <button
                  onClick={() => {
                    closeMobileMenu();
                    handleSignOut();
                  }}
                  disabled={isSigningOut}
                  className="w-full inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    closeMobileMenu();
                    setShowAuth(true);
                  }}
                  className="w-full inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </button>
              )}
            </div>
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