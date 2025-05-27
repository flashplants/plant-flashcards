'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, House, GalleryHorizontalEnd, CircleGauge, Leaf } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export default function Footer() {
  const pathname = usePathname();
  const [showAuth, setShowAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, supabase } = useAuth();

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

  const handleDashboardClick = (e) => {
    if (!isAdmin) {
      e.preventDefault();
      setShowAuth(true);
    }
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-around items-center">
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/'
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <House className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link
            href="/plants"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/plants'
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <Leaf className="w-5 h-5" />
            <span className="text-xs font-medium">Plants</span>
          </Link>
          <Link
            href="/flashcards"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/flashcards'
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <GalleryHorizontalEnd className="w-5 h-5" />
            <span className="text-xs font-medium">Flashcards</span>
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard"
              onClick={handleDashboardClick}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                pathname === '/dashboard'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <CircleGauge className="w-5 h-5" />
              <span className="text-xs font-medium">Admin</span>
            </Link>
          )}
        </div>
      </nav>
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
      />
    </footer>
  );
} 