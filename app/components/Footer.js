'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GalleryHorizontalEnd, Leaf, Settings, Award, Home, Book, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Footer() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-around items-center">
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
          <Link
            href="/quiz"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors text-gray-600 hover:text-green-600 hover:bg-green-50"
          >
            <Brain className="w-5 h-5" />
            <span className="text-xs font-medium">Quiz Hub</span>
          </Link>
          {user && (
            <Link
              href="/profile"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors text-gray-600 hover:text-green-600 hover:bg-green-50"
            >
              <Award className="w-5 h-5" />
              <span className="text-xs font-medium">My Profile</span>
            </Link>
          )}
        </div>
      </nav>
    </footer>
  );
} 