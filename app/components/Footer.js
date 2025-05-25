'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-around items-center">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/dashboard'
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Dashboard</span>
          </Link>
          <Link
            href="/flashcards"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              pathname === '/flashcards'
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-xs font-medium">Flashcards</span>
          </Link>
        </div>
      </nav>
    </footer>
  );
} 