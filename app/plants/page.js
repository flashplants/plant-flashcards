'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Star, Leaf, GalleryHorizontalEnd, Brain } from 'lucide-react';
import { Button } from "../../components/ui/button";
import { buildFullPlantName, renderPlantName } from '../utils/plantNameUtils';
import PlantFilterPanel from '../components/PlantFilterPanel';
import { parseFiltersFromUrl, serializeFiltersToUrl } from '../utils/filters';
import { useSyncedFilters } from '../hooks/useSyncedFilters';
import { applyFilters } from '../utils/filters';

function PlantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [plants, setPlants] = useState([]);
  const [allPlants, setAllPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalSightings, setGlobalSightings] = useState({});
  const [userSightings, setUserSightings] = useState({});
  const [isFetchingUserData, setIsFetchingUserData] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [collections, setCollections] = useState([]);
  const [showAdminPlants, setShowAdminPlants] = useState(true);
  const [showAdminCollections, setShowAdminCollections] = useState(true);
  const [showAdminSightings, setShowAdminSightings] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useSyncedFilters();

  // Filtering logic for all plants
  const filteredAllPlants = useMemo(() => {
    return applyFilters(allPlants, filters, { 
      favorites,
      answered: null,
      userSightings,
      globalSightings,
      showAdminPlants,
      user
    });
  }, [allPlants, filters, favorites, userSightings, globalSightings, showAdminPlants, user]);

  // Get paginated subset of filtered plants
  const paginatedPlants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAllPlants.slice(start, end);
  }, [filteredAllPlants, currentPage, pageSize]);

  const getFavoritesCount = () => allPlants.filter(p => favorites.has(p.id)).length;
  const getCollectionPlantCount = (col) => {
    return allPlants.filter(plant => plant.collection_plants?.some(cp => cp.collection_id === col.id)).length;
  };

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('show_admin_plants, show_admin_collections, show_admin_sightings')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            if (typeof data.show_admin_plants === 'boolean') setShowAdminPlants(data.show_admin_plants);
            if (typeof data.show_admin_collections === 'boolean') setShowAdminCollections(data.show_admin_collections);
            if (typeof data.show_admin_sightings === 'boolean') setShowAdminSightings(data.show_admin_sightings);
          }
        });
    }
  }, [user]);

  useEffect(() => {
    fetchPlants();
    fetchCollections();
    if (user) {
      fetchFavorites();
    }
  }, [user, showAdminPlants]);

  const fetchGlobalSightings = async (plantIds) => {
    if (!plantIds.length) return;
    const { data, error } = await supabase
      .from('global_sighting_counts')
      .select('plant_id, sighting_count')
      .in('plant_id', plantIds);
    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        counts[row.plant_id] = row.sighting_count;
      });
      setGlobalSightings(counts);
    }
  };

  const fetchUserSightings = async (plantIds) => {
    if (!plantIds.length || !user) return;
    const { data, error } = await supabase
      .from('sightings')
      .select('plant_id')
      .eq('user_id', user.id)
      .in('plant_id', plantIds);
    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        counts[row.plant_id] = (counts[row.plant_id] || 0) + 1;
      });
      setUserSightings(counts);
    }
  };

  const fetchPlants = async () => {
    try {
      // Get user's admin status first
      let isAdmin = false;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        
        isAdmin = profile?.is_admin || false;
        console.log('User profile:', { userId: user.id, isAdmin });
      }

      // Build base query conditions
      const baseConditions = (query) => {
        query = query.eq('is_published', true);
        if (user) {
          if (isAdmin) {
            query = query.eq('is_admin_plant', true);
          } else {
            query = query.or(`is_admin_plant.eq.true,user_id.eq.${user.id}`);
          }
        } else {
          query = query.eq('is_admin_plant', true);
        }
        return query;
      };

      // First, get the total count
      let countQuery = baseConditions(supabase
        .from('plants')
        .select('*', { count: 'exact', head: true }));

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));

      // Fetch all plants for filter stats
      let allPlantsQuery = baseConditions(supabase
        .from('plants')
        .select(`
          *,
          plant_images (
            id,
            path,
            is_primary
          ),
          collection_plants (
            collection_id
          )
        `)
        .order('scientific_name'));

      const { data: allPlantsData, error: allPlantsError } = await allPlantsQuery;
      if (allPlantsError) throw allPlantsError;
      setAllPlants(allPlantsData || []);

      // Fetch sightings for all plants
      if (allPlantsData && allPlantsData.length) {
        const allPlantIds = allPlantsData.map(p => p.id);
        fetchGlobalSightings(allPlantIds);
        if (user) {
          fetchUserSightings(allPlantIds);
        }
      }

      // Then fetch the paginated data
      let paginatedQuery = baseConditions(supabase
        .from('plants')
        .select(`
          *,
          plant_images (
            id,
            path,
            is_primary
          ),
          collection_plants (
            collection_id
          )
        `)
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
        .order('scientific_name'));

      const { data, error } = await paginatedQuery;

      if (error) throw error;
      console.log('Query results:', {
        totalPlants: data?.length,
        plants: data?.map(p => ({
          id: p.id,
          name: p.scientific_name,
          isAdmin: p.is_admin_plant,
          userId: p.user_id,
          isPublished: p.is_published
        }))
      });

      let filtered = data || [];
      if (user && !showAdminPlants) {
        filtered = filtered.filter(plant => !plant.is_admin_plant || plant.user_id === user.id);
      }
      setPlants(filtered);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching plants:', err);
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      console.log('=== COLLECTIONS FETCH START ===');
      console.log('User:', user?.id);
      console.log('Show admin collections:', showAdminCollections);
      
      let query = supabase
        .from('collections')
        .select('id, name, is_published, is_admin_collection, user_id')
        .eq('is_published', true);

      // If user is logged in, show their collections and admin collections
      if (user) {
        console.log('User is logged in, showing user collections and admin collections');
        query = query.or(`user_id.eq.${user.id},is_admin_collection.eq.true`);
      } else {
        console.log('User is not logged in, showing only admin collections');
        query = query.eq('is_admin_collection', true);
      }

      const { data, error } = await query;
      
      console.log('=== COLLECTIONS DATA ===');
      console.log('Raw data:', data);
      console.log('Error:', error);
      
      if (data) {
        console.log('Collections breakdown:');
        console.log('Admin collections:', data.filter(c => c.is_admin_collection));
        console.log('User collections:', data.filter(c => !c.is_admin_collection));
      }
      console.log('=== END COLLECTIONS DATA ===');

      if (error) {
        console.error('Error fetching collections:', error);
        return;
      }

      if (data) {
        console.log('Setting collections:', data);
        setCollections(data);
      } else {
        console.log('No collections data returned');
      }
    } catch (err) {
      console.error('Error in fetchCollections:', err);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('plant_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setFavorites(new Set(data.map(f => f.plant_id)));
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  const toggleFavorite = async (plant) => {
    if (!user) {
      router.push('/login');
      return;
    }

    const isFavorite = favorites.has(plant.id);

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('plant_id', plant.id);
        
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(plant.id);
          return next;
        });
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, plant_id: plant.id });
        
        setFavorites(prev => new Set([...prev, plant.id]));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const getCollectionNames = (plant) => {
    const collectionIds = plant.collection_plants?.map(cp => cp.collection_id) || [];
    return collections
      .filter(c => collectionIds.includes(c.id))
      .filter(c => showAdminCollections || !c.is_admin_collection)
      .map(c => c.name);
  };

  const handleStudyPlants = () => {
    const search = searchParams.toString();
    router.push(`/flashcards${search ? `?${search}` : ''}`, { scroll: false });
  };

  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('page', currentPage);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [currentPage]);

  useEffect(() => {
    fetchPlants();
  }, [currentPage, pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Plants</h1>
              <p className="mt-2 text-gray-600">Browse our collection of plants</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleStudyPlants}
                className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
              >
                <GalleryHorizontalEnd className="h-4 w-4" />
                <span>Study {filteredAllPlants.length} Plants with Flashcards</span>
              </Button>
              <Button
                onClick={() => router.push(`/quiz?${searchParams.toString()}`)}
                className="flex items-center gap-2 w-full sm:w-auto text-sm sm:text-base"
              >
                <Brain className="h-4 w-4" />
                <span>Quiz me on these {filteredAllPlants.length} plants</span>
              </Button>
            </div>
          </div>
        </div>

        <PlantFilterPanel
          user={user}
          plants={allPlants}
          filteredPlants={filteredAllPlants}
          collections={collections}
          filters={filters}
          setFilters={setFilters}
          showAdminSightings={showAdminSightings}
          showAdminCollections={showAdminCollections}
          showAdminPlants={showAdminPlants}
          getFavoritesCount={getFavoritesCount}
          getCollectionPlantCount={getCollectionPlantCount}
          totalCount={totalCount}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedPlants.map((plant) => (
            <Card 
              key={plant.id}
              className="overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              onClick={() => {
                console.log('Plant data:', {
                  id: plant.id,
                  slug: plant.slug,
                  is_admin_plant: plant.is_admin_plant,
                  user_id: plant.user_id
                });
                if (plant.slug) {
                  router.push(`/plants/${plant.slug}`);
                } else {
                  console.error('No slug found for plant:', plant);
                }
              }}
            >
              <div className="aspect-square relative">
                {plant.plant_images?.length > 0 ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${plant.is_admin_plant ? 'plant-images' : 'user-plant-images'}/${(plant.plant_images.find(img => img.is_primary) || plant.plant_images[0]).path}`}
                    alt={renderPlantName(plant)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <Leaf className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(plant);
                  }}
                >
                  <Star 
                    className={`w-5 h-5 ${favorites.has(plant.id) ? 'fill-current text-yellow-500' : 'text-gray-400'}`} 
                  />
                </Button>
              </div>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {renderPlantName(plant)}
                  </h3>
                </div>
                {plant.common_name && (
                  <p className="text-sm text-gray-600 mb-3">{plant.common_name}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {plant.is_admin_plant ? (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                      Admin Plant
                    </Badge>
                  ) : plant.user_id === user?.id ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      My Plant
                    </Badge>
                  ) : null}
                  {getCollectionNames(plant).map((name, index) => (
                    <Badge key={index} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                  {showAdminSightings && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                      Global sightings: {globalSightings[plant.id] || 0}
                    </Badge>
                  )}
                  {user && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                      My sightings: {userSightings[plant.id] || 0}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 mb-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value={12}>12 per page</option>
              <option value={24}>24 per page</option>
              <option value={48}>48 per page</option>
            </select>
            <span className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAllPlants.length)} of {filteredAllPlants.length} plants
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {Math.ceil(filteredAllPlants.length / pageSize)}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAllPlants.length / pageSize), p + 1))}
              disabled={currentPage === Math.ceil(filteredAllPlants.length / pageSize)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.ceil(filteredAllPlants.length / pageSize))}
              disabled={currentPage === Math.ceil(filteredAllPlants.length / pageSize)}
            >
              Last
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlantsContent />
    </Suspense>
  );
} 