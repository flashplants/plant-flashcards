import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Star, Check, CircleDashed, Binoculars, Info, Filter, User } from 'lucide-react';
import React from 'react';
import { defaultFilters } from '../utils/filters';

// Tooltip component (copied from flashcards page)
function Tooltip({ text, children }) {
  return (
    <span className="relative group">
      {children}
      <span
        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 w-[30vw] max-w-[30vw] min-w-[8rem] whitespace-normal rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-800"
      >
        {text}
      </span>
    </span>
  );
}

export default function PlantFilterPanel({
  user,
  plants,
  collections,
  filters,
  setFilters,
  showAdminSightings,
  showAdminCollections,
  showAdminPlants,
  getFavoritesCount,
  getCollectionPlantCount,
  filteredPlants,
  needPracticeCount,
}) {
  return (
    <div className="mb-6 bg-white rounded-lg shadow-md overflow-hidden">
      <button
        onClick={() => setFilters({ ...filters, isFiltersExpanded: !filters.isFiltersExpanded })}
        className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-700">Filters</span>
        </div>
        <span className="ml-auto font-medium text-gray-600">Studying {filteredPlants?.length || plants.length} plants</span>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${filters.isFiltersExpanded ? 'rotate-0' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${filters.isFiltersExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Filters Group */}
          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
            <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Leaf className="w-4 h-4 text-green-600" />
              Main Filters
              <Tooltip text="Primary ways to filter your study set, including all plants, favorites, testable, and practice-needed."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  // Reset all filters to default values
                  setFilters(defaultFilters);
                }}
                variant={!filters.selectedCollection && !filters.needPractice && !filters.favoritesOnly && !filters.testableOnly && filters.sightingsFilter === 'all' && !filters.mySightingsFilter ? 'default' : 'outline'}
                className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${!filters.selectedCollection && !filters.needPractice && !filters.favoritesOnly && !filters.testableOnly && filters.sightingsFilter === 'all' && !filters.mySightingsFilter ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                aria-pressed={!filters.selectedCollection && !filters.needPractice && !filters.favoritesOnly && !filters.testableOnly && filters.sightingsFilter === 'all' && !filters.mySightingsFilter}
              >
                All Plants
                <Badge className="ml-2 bg-green-600 text-white font-semibold">{plants.length}</Badge>
              </Button>
              {!user ? (
                <>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1 rounded-md border-2 text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
                    disabled
                  >
                    <Star className="w-4 h-4" />
                    Favorites
                    <Badge className="ml-2 bg-gray-200 text-gray-400">0</Badge>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1 rounded-md border-2 text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
                    disabled
                  >
                    <Check className="w-4 h-4" />
                    Test Me
                  </Button>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1 rounded-md border-2 text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
                    disabled
                  >
                    <CircleDashed className="w-4 h-4" />
                    Need Practice
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setFilters({
                        ...filters,
                        favoritesOnly: !filters.favoritesOnly
                      });
                    }}
                    variant={filters.favoritesOnly ? 'default' : 'outline'}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.favoritesOnly ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                    aria-pressed={filters.favoritesOnly}
                  >
                    <Star className="w-4 h-4" />
                    Favorites
                    <Badge className="ml-2 bg-green-600 text-white font-semibold">{getFavoritesCount()}</Badge>
                  </Button>
                  <Button
                    onClick={() => {
                      setFilters({
                        ...filters,
                        testableOnly: !filters.testableOnly
                      });
                    }}
                    variant={filters.testableOnly ? 'default' : 'outline'}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.testableOnly ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                    aria-pressed={filters.testableOnly}
                  >
                    <Check className="w-4 h-4" />
                    Test Me
                  </Button>
                  <Button
                    onClick={() => {
                      setFilters({
                        ...filters,
                        needPractice: !filters.needPractice
                      });
                    }}
                    variant={filters.needPractice ? 'default' : 'outline'}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.needPractice ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                    aria-pressed={filters.needPractice}
                  >
                    <CircleDashed className="w-4 h-4" />
                    Need Practice
                    <Badge className="ml-2 bg-yellow-600 text-white font-semibold">{needPracticeCount}</Badge>
                  </Button>
                </>
              )}
            </div>
          </div>
          {/* Sightings Filter Group */}
          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
            <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Binoculars className="w-4 h-4 text-gray-600" />
              Sightings
              <Tooltip text="Filter by the number of times a plant has been sighted globally or by you."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
            </div>
            {!user ? (
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-gray-600 mb-2">Sign up to track your plant sightings!</p>
                <Button
                  variant="outline"
                  className="text-gray-600 border-gray-300 hover:bg-gray-100"
                  disabled
                >
                  Sign Up to Enable
                </Button>
              </div>
            ) : (
              <>
                {/* Global Sightings Buttons */}
                {showAdminSightings && (
                  <div className="mb-2">
                    <div className="font-medium text-gray-600 mb-1">Global Sightings</div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant={filters.sightingsFilter === 'all' && !filters.mySightingsFilter ? 'default' : 'outline'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${(filters.sightingsFilter === 'all' && !filters.mySightingsFilter) ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                        aria-pressed={filters.sightingsFilter === 'all' && !filters.mySightingsFilter}
                        onClick={() => {
                          setFilters({
                            ...filters,
                            sightingsFilter: 'all',
                            mySightingsFilter: null
                          });
                        }}
                      >
                        All
                      </Button>
                      <Button
                        variant={filters.sightingsFilter === '1' && !filters.mySightingsFilter ? 'default' : 'outline'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${(filters.sightingsFilter === '1' && !filters.mySightingsFilter) ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                        aria-pressed={filters.sightingsFilter === '1' && !filters.mySightingsFilter}
                        onClick={() => {
                          setFilters({
                            ...filters,
                            sightingsFilter: '1',
                            mySightingsFilter: null
                          });
                        }}
                      >
                        1+
                      </Button>
                      <Button
                        variant={filters.sightingsFilter === '2' && !filters.mySightingsFilter ? 'default' : 'outline'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${(filters.sightingsFilter === '2' && !filters.mySightingsFilter) ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                        aria-pressed={filters.sightingsFilter === '2' && !filters.mySightingsFilter}
                        onClick={() => {
                          setFilters({
                            ...filters,
                            sightingsFilter: '2',
                            mySightingsFilter: null
                          });
                        }}
                      >
                        2+
                      </Button>
                      <Button
                        variant={filters.sightingsFilter === '3' && !filters.mySightingsFilter ? 'default' : 'outline'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${(filters.sightingsFilter === '3' && !filters.mySightingsFilter) ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                        aria-pressed={filters.sightingsFilter === '3' && !filters.mySightingsFilter}
                        onClick={() => {
                          setFilters({
                            ...filters,
                            sightingsFilter: '3',
                            mySightingsFilter: null
                          });
                        }}
                      >
                        3+
                      </Button>
                    </div>
                  </div>
                )}
                {/* My Sightings Buttons */}
                <div>
                  <div className="font-medium text-gray-600 mb-1">My Sightings</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filters.mySightingsFilter === 'all' ? 'default' : 'outline'}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.mySightingsFilter === 'all' ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                      aria-pressed={filters.mySightingsFilter === 'all'}
                      onClick={() => {
                        setFilters({
                          ...filters,
                          mySightingsFilter: null,
                          sightingsFilter: 'all'
                        });
                      }}
                    >
                      All
                    </Button>
                    <Button
                      variant={filters.mySightingsFilter === '1' ? 'default' : 'outline'}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.mySightingsFilter === '1' ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                      aria-pressed={filters.mySightingsFilter === '1'}
                      onClick={() => {
                        setFilters({
                          ...filters,
                          mySightingsFilter: '1',
                          sightingsFilter: 'all'
                        });
                      }}
                    >
                      1+
                    </Button>
                    <Button
                      variant={filters.mySightingsFilter === '2' ? 'default' : 'outline'}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.mySightingsFilter === '2' ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                      aria-pressed={filters.mySightingsFilter === '2'}
                      onClick={() => {
                        setFilters({
                          ...filters,
                          mySightingsFilter: '2',
                          sightingsFilter: 'all'
                        });
                      }}
                    >
                      2+
                    </Button>
                    <Button
                      variant={filters.mySightingsFilter === '3' ? 'default' : 'outline'}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${filters.mySightingsFilter === '3' ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'}`}
                      aria-pressed={filters.mySightingsFilter === '3'}
                      onClick={() => {
                        setFilters({
                          ...filters,
                          mySightingsFilter: '3',
                          sightingsFilter: 'all'
                        });
                      }}
                    >
                      3+
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* My Collections Group */}
          {!user ? (
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                My Collections
                <Tooltip text="Create and manage your own plant collections."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
              </div>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-gray-600 mb-2">Sign up to create your own collections!</p>
                <Button
                  variant="outline"
                  className="text-gray-600 border-gray-300 hover:bg-gray-100"
                  disabled
                >
                  Sign Up to Enable
                </Button>
              </div>
            </div>
          ) : collections && collections.some(col => col.user_id === user.id) && (
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
              <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                My Collections
                <Tooltip text="Collections you've created to organize your plants."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {collections
                  .filter(col => user && col.user_id === user.id)
                  .map(col => (
                    <Button
                      key={col.id}
                      variant={filters.selectedCollection === col.id ? 'default' : 'outline'}
                      onClick={() => setFilters({
                        ...filters,
                        selectedCollection: filters.selectedCollection === col.id ? null : col.id
                      })}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${
                        filters.selectedCollection === col.id ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      <span>{col.name}</span>
                      <Badge className="ml-2 bg-green-600 text-white font-semibold">
                        {getCollectionPlantCount(col) || 0}
                      </Badge>
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {/* Admin Collections Group */}
          {!user ? (
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-600" />
                Admin Collections
                <Tooltip text="Official collections curated by administrators."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
              </div>
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-gray-600 mb-2">Sign up to access admin collections!</p>
                <Button
                  variant="outline"
                  className="text-gray-600 border-gray-300 hover:bg-gray-100"
                  disabled
                >
                  Sign Up to Enable
                </Button>
              </div>
            </div>
          ) : showAdminCollections && collections && collections.some(col => col.is_admin_collection) && (
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
              <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-600" />
                Admin Collections
                <Tooltip text="Official collections curated by administrators."><Info className="w-4 h-4 text-gray-400 cursor-pointer" /></Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                {collections
                  .filter(col => col.is_admin_collection)
                  .map(col => (
                    <Button
                      key={col.id}
                      variant={filters.selectedCollection === col.id ? 'default' : 'outline'}
                      onClick={() => setFilters({
                        ...filters,
                        selectedCollection: filters.selectedCollection === col.id ? null : col.id
                      })}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md border-2 hover:bg-green-100 ${
                        filters.selectedCollection === col.id ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      <span>{col.name}</span>
                      <Badge className="ml-2 bg-green-600 text-white font-semibold">
                        {getCollectionPlantCount(col) || 0}
                      </Badge>
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 