// app/components/Header.js
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Leaf, LogIn, LogOut, GalleryHorizontalEnd, CircleGauge, Menu, X, User, ClipboardList, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const { user, signOut, supabase } = useAuth();
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, display_name')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(profile?.is_admin || false);
        setDisplayName(profile?.display_name || '');
      } else {
        setIsAdmin(false);
        setDisplayName('');
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

  const handleDashboardClick = () => {
    router.push('/dashboard');
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
        <div className="flex w-full items-center h-16">
          <Link href="/" className="flex items-center">
            <Leaf className="w-5 h-5 text-green-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Plant Flashcards</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 ml-auto">
            {user && displayName && (
              <Badge className="bg-green-100 text-green-800 font-semibold px-3 py-1 text-base rounded-full min-w-0 max-w-[8rem] sm:max-w-xs truncate">
                <span className="block truncate text-sm sm:text-base">{displayName}</span>
              </Badge>
            )}
            {user && (
              <Button
                variant="ghost"
                onClick={handleDashboardClick}
                className={cn(
                  "flex items-center justify-center p-2 text-base font-medium",
                  pathname.startsWith("/dashboard") ? "text-green-600" : "text-gray-700 hover:text-green-600"
                )}
                title="Dashboard"
              >
                <ClipboardList className="w-6 h-6" />
              </Button>
            )}
            {user && (
              <Button
                variant="ghost"
                onClick={() => router.push('/settings')}
                className={cn(
                  "flex items-center justify-center p-2 text-base font-medium",
                  pathname.startsWith("/settings") ? "text-green-600" : "text-gray-700 hover:text-green-600"
                )}
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </Button>
            )}
            {user ? (
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="flex items-center justify-center p-2 text-base font-medium text-gray-700 hover:text-green-600"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-2 px-3 py-2 text-base font-medium text-gray-700 hover:text-green-600"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </Button>
            )}
          </nav>
          {/* Hamburger menu button for mobile */}
          <button
            className="ml-auto md:hidden p-2 rounded-md text-gray-700 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={toggleMobileMenu}
            aria-label="Open menu"
          >
            <Menu className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-[100] transform transition-transform duration-300 ease-in-out ${
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
              <div className="px-3 py-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 min-w-0 max-w-[12rem] text-base rounded-full px-3 py-1 block truncate">
                  <span className="block truncate text-base">{displayName}</span>
                </Badge>
              </div>
              <button
                onClick={() => {
                  closeMobileMenu();
                  handleDashboardClick();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/dashboard'
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              {user && (
                <Link
                  href="/settings"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    pathname === '/settings' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
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
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-gray-600 hover:text-green-600 hover:bg-green-50 disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    closeMobileMenu();
                    setShowAuth(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-gray-600 hover:text-green-600 hover:bg-green-50"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
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