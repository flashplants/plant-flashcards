'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { debounce } from 'lodash';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../../lib/utils';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PlantImageManager from '../components/PlantImageManager';
import BulkImageUpload from '../components/BulkImageUpload';
import AuthModal from '../components/AuthModal';
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Badge } from "../../components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  File,
  Image,
  Star,
  Trash2,
  Upload,
  X,
  Plus,
  Minus,
  Edit,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronsUpDown,
  Filter,
  Search
} from 'lucide-react';

// Helper function to convert image to WebP
const convertToWebP = async (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/webp', 0.8);
    };
    img.onerror = reject;
  });
};

// Helper function to generate a short random suffix
const generateSuffix = () => {
  return Math.random().toString(36).substring(2, 6);
};

function buildFullPlantName(plant) {
  // Remove punctuation and join all relevant fields
  const clean = (str) => str ? str.replace(/[^a-zA-Z0-9-]/g, '') : '';
  
  // Build the name parts array
  let nameParts = [];
  
  // Add hybrid marker based on position
  if (plant.hybrid_marker) {
    if (plant.hybrid_marker_position === 'before_genus') {
      nameParts.push(plant.hybrid_marker);
    }
  }
  
  // Add genus
  nameParts.push(plant.genus);
  
  // Add hybrid marker if it should be between genus and species
  if (plant.hybrid_marker && plant.hybrid_marker_position === 'between_genus_species') {
    nameParts.push(plant.hybrid_marker);
  }
  
  // Add remaining parts
  nameParts = nameParts.concat([
    plant.specific_epithet,
    plant.infraspecies_rank,
    plant.infraspecies_epithet,
    plant.variety,
    plant.cultivar
  ]);
  
  return nameParts
    .map(clean)
    .filter(Boolean)
    .join(' ');
}

// Helper to get unique collection labels
const getCollectionLabel = (col, allCollections) => {
  const nameCount = allCollections.filter(c => c.name === col.name).length;
  return nameCount > 1 ? `${col.name} (ID: ${col.id})` : col.name;
};

const getCollectionName = (id, allCollections) => {
  const col = allCollections.find(c => c.id === id);
  return col ? col.name : 'Collection';
};

function DashboardContent() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [newPlant, setNewPlant] = useState({
    scientific_name: '',
    common_name: '',
    family: '',
    genus: '',
    species: '',
    specific_epithet: '',
    subspecies: '',
    variety: '',
    cultivar: '',
    description: '',
    is_published: false,
    hybrid_marker: '',
    hybrid_marker_position: 'none',
    infraspecies_rank: '',
    infraspecies_epithet: '',
    native_to: '',
    bloom_period: '',
    image_url: '',
    external_resources: {},
    slug: '',
    default_collection_id: null
  });
  const [showNewPlantForm, setShowNewPlantForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [globalSightings, setGlobalSightings] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    is_published: null,
    collection_id: null
  });

  // Pagination state from URL
  const searchParams = useSearchParams();
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const pathname = usePathname();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', authUser.id)
          .single();
        if (!profile?.is_admin) {
          router.replace('/');
          setLoading(false);
          return;
        }
        setIsAdmin(true);
        fetchPlants();
        setLoading(false);
        return;
      }
      setLoading(false);
    };
    checkAdminStatus();
  }, [authUser, router]);

  useEffect(() => {
    if (authUser) {
      fetchUserData();
    }
  }, [authUser]);

  const fetchUserData = async () => {
    // Fetch user's favorites
    const { data: favData } = await supabase
      .from('favorites')
      .select('plant_id')
      .eq('user_id', authUser.id);
    
    if (favData) {
      setFavorites(new Set(favData.map(f => f.plant_id)));
    }
  };

  // Fetch global sightings counts for all plants on page
  const fetchGlobalSightings = useCallback(async (plantIds) => {
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
  }, []);

  // Fetch suggestions
  const fetchSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const { data } = await supabase
      .from('plants')
      .select('scientific_name, common_name, genus, family')
      .or(`scientific_name.ilike.%${query}%,common_name.ilike.%${query}%,genus.ilike.%${query}%`)
      .limit(5);

    setSuggestions(data || []);
  };

  // Debounced suggestion fetch
  const debouncedFetchSuggestions = useCallback(
    debounce(fetchSuggestions, 200),
    []
  );

  // Update search when query changes
  useEffect(() => {
    debouncedFetchSuggestions(searchQuery);
    return () => debouncedFetchSuggestions.cancel();
  }, [searchQuery, debouncedFetchSuggestions]);

  // Fetch collections for filter
  useEffect(() => {
    const fetchCollections = async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name')
        .order('name');
      if (!error && data) setCollections(data);
    };
    fetchCollections();
  }, []);

  // Modify the search function to include filters
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      const trimmed = query.trim();
      // Always re-run filter logic when search is cleared
      if (!trimmed) {
        fetchPlants();
        return;
      }
      setIsSearching(true);
      try {
        let queryBuilder = supabase
          .from('plants')
          .select(`
            *,
            plant_images (
              id,
              path,
              is_primary
            )
          `);
        // Improved search logic
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (trimmed) {
          if (words.length < 2) {
            // Partial match for any single word or partial input
            queryBuilder = queryBuilder.or(`scientific_name.ilike.%${trimmed}%,common_name.ilike.%${trimmed}%,genus.ilike.%${trimmed}%`);
          } else {
            // Full-text search for multi-word
            queryBuilder = queryBuilder.textSearch('search_vector', trimmed, {
              type: 'websearch',
              config: 'english'
            });
          }
        }
        // Add filters
        if (selectedFilters.is_published !== null) {
          queryBuilder = queryBuilder.eq('is_published', selectedFilters.is_published);
        }
        if (selectedFilters.collection_id) {
          // Filter by collection using collection_plants join
          const { data: cpData, error: cpError } = await supabase
            .from('collection_plants')
            .select('plant_id')
            .eq('collection_id', selectedFilters.collection_id);
          if (cpError) throw cpError;
          const plantIds = cpData.map(cp => cp.plant_id);
          setTotalCount(plantIds.length);
          setTotalPages(Math.ceil(plantIds.length / pageSize));
          const pagedPlantIds = plantIds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
          if (pagedPlantIds.length > 0) {
            queryBuilder = queryBuilder.in('id', pagedPlantIds);
          } else {
            setPlants([]);
            setGlobalSightings({});
            setTotalCount(0);
            setTotalPages(1);
            setIsSearching(false);
            return;
          }
        }
        const { data, error } = await queryBuilder.order('scientific_name');
        if (error) throw error;
        setPlants(data || []);
        setTotalCount(data?.length || 0);
        setTotalPages(Math.ceil((data?.length || 0) / pageSize));
        if (data && data.length) {
          fetchGlobalSightings(data.map(p => p.id));
        } else {
          setGlobalSightings({});
        }
      } catch (err) {
        console.error('Search error:', err);
        setError(err.message);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [selectedFilters]
  );

  // Update search when query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  // Modify fetchPlants to handle search
  const fetchPlants = async () => {
    try {
      if (searchQuery.trim()) {
        await debouncedSearch(searchQuery);
        return;
      }
      // If collection filter is active, filter by collection
      if (selectedFilters.collection_id) {
        const { data: cpData, error: cpError } = await supabase
          .from('collection_plants')
          .select('plant_id')
          .eq('collection_id', selectedFilters.collection_id);
        if (cpError) throw cpError;
        const plantIds = cpData.map(cp => cp.plant_id);
        setTotalCount(plantIds.length);
        setTotalPages(Math.ceil(plantIds.length / pageSize));
        const pagedPlantIds = plantIds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        if (pagedPlantIds.length > 0) {
          const { data, error } = await supabase
            .from('plants')
            .select(`
              *,
              plant_images (
                id,
                path,
                is_primary
              )
            `)
            .in('id', pagedPlantIds)
            .order('scientific_name');
          if (error) throw error;
          setPlants(data || []);
          setLoading(false);
          if (data && data.length) {
            fetchGlobalSightings(data.map(p => p.id));
          } else {
            setGlobalSightings({});
          }
          return;
        } else {
          setPlants([]);
          setGlobalSightings({});
          setTotalCount(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }
      // Default: fetch all plants paginated
      const { count, error: countError } = await supabase
        .from('plants')
        .select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));
      const { data, error } = await supabase
        .from('plants')
        .select(`
          *,
          plant_images (
            id,
            path,
            is_primary
          )
        `)
        .order('scientific_name')
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
      if (error) throw error;
      setPlants(data || []);
      setLoading(false);
      if (data && data.length) {
        fetchGlobalSightings(data.map(p => p.id));
      } else {
        setGlobalSightings({});
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [currentPage, pageSize]);

  useEffect(() => {
    // Update the URL with the current page (without reload)
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('page', currentPage);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line
  }, [currentPage]);

  const handleEdit = (plant) => {
    setEditingPlant({ ...plant });
  };

  const handleSave = async (plant) => {
    try {
      const { error } = await supabase
        .from('plants')
        .update({
          scientific_name: plant.scientific_name,
          common_name: plant.common_name,
          family: plant.family,
          genus: plant.genus,
          species: plant.species,
          specific_epithet: plant.specific_epithet,
          subspecies: plant.subspecies,
          variety: plant.variety,
          cultivar: plant.cultivar,
          description: plant.description,
          is_published: plant.is_published,
          hybrid_marker: plant.hybrid_marker,
          hybrid_marker_position: plant.hybrid_marker_position,
          infraspecies_rank: plant.infraspecies_rank,
          infraspecies_epithet: plant.infraspecies_epithet,
          native_to: plant.native_to,
          bloom_period: plant.bloom_period,
          image_url: plant.image_url,
          external_resources: plant.external_resources,
          slug: plant.slug,
          default_collection_id: plant.default_collection_id
        })
        .eq('id', plant.id);

      if (error) throw error;
      setEditingPlant(null);
      fetchPlants();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (plantId) => {
    if (!confirm('Are you sure you want to delete this plant?')) return;

    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .eq('id', plantId);

      if (error) throw error;
      fetchPlants();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('plants')
        .insert([newPlant]);

      if (error) throw error;
      setShowNewPlantForm(false);
      setNewPlant({
        scientific_name: '',
        common_name: '',
        family: '',
        genus: '',
        species: '',
        specific_epithet: '',
        subspecies: '',
        variety: '',
        cultivar: '',
        description: '',
        is_published: false,
        hybrid_marker: '',
        hybrid_marker_position: 'none',
        infraspecies_rank: '',
        infraspecies_epithet: '',
        native_to: '',
        bloom_period: '',
        image_url: '',
        external_resources: {},
        slug: '',
        default_collection_id: null
      });
      fetchPlants();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleFavorite = async (plant) => {
    if (!authUser) {
      alert('Please log in to add favorites');
      return;
    }

    const isFavorite = favorites.has(plant.id);

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', authUser.id)
          .eq('plant_id', plant.id);
        
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(plant.id);
          return next;
        });
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: authUser.id, plant_id: plant.id });
        
        setFavorites(prev => new Set([...prev, plant.id]));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredPlants = showFavoritesOnly 
    ? plants.filter(plant => favorites.has(plant.id))
    : plants;

  const PaginationControls = () => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const maxVisiblePages = 5;
    let visiblePages = pages;

    if (totalPages > maxVisiblePages) {
      const start = Math.max(
        Math.min(
          currentPage - Math.floor(maxVisiblePages / 2),
          totalPages - maxVisiblePages + 1
        ),
        1
      );
      visiblePages = pages.slice(start - 1, start - 1 + maxVisiblePages);
    }

    return (
      <div className="flex items-center justify-between px-2 py-4 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {visiblePages.map(page => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>
    );
  };

  // Increment/decrement global sightings
  const updateGlobalSighting = async (plantId, delta) => {
    const current = globalSightings[plantId] || 0;
    const newCount = Math.max(0, current + delta);
    setGlobalSightings(prev => ({ ...prev, [plantId]: newCount })); // Optimistic
    let error = null;
    if (delta > 0) {
      // Insert a new row into global_sightings
      ({ error } = await supabase
        .from('global_sightings')
        .insert({ plant_id: plantId }));
    } else if (delta < 0 && current > 0) {
      // Delete one row for this plant_id (the oldest)
      // Get the oldest id for this plant
      const { data: rows, error: fetchError } = await supabase
        .from('global_sightings')
        .select('id')
        .eq('plant_id', plantId)
        .order('id', { ascending: true })
        .limit(1);
      if (!fetchError && rows && rows.length > 0) {
        const rowId = rows[0].id;
        ({ error } = await supabase
          .from('global_sightings')
          .delete()
          .eq('id', rowId));
      } else {
        error = fetchError || new Error('No global sighting row to delete');
      }
    }
    // Always re-fetch counts after change
    await fetchGlobalSightings(plants.map(p => p.id));
    if (error) {
      // Revert on error
      setGlobalSightings(prev => ({ ...prev, [plantId]: current }));
      alert('Failed to update global sightings: ' + (error.message || error));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!loading && !isAdmin) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Plants</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchPlants}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-16">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)}
          onSuccess={(user) => {
            setUser(user);
            fetchUserData();
          }}
        />

        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Plants Dashboard</h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-5 h-5" />
                </span>
                <Input
                  type="text"
                  placeholder="Search plants..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-12 pl-10 pr-4 text-base w-full bg-white"
                />
              </div>
              {/* Filters Button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="h-12 w-full sm:w-[140px] flex items-center justify-between px-4 text-base"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-4">
                  <div className="space-y-4">
                    {/* Published Status Filter */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Published Status</h4>
                      <div className="flex gap-2">
                        <Badge
                          variant={selectedFilters.is_published === true ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedFilters(prev => ({
                              ...prev,
                              is_published: prev.is_published === true ? null : true
                            }));
                          }}
                        >
                          Published
                          {selectedFilters.is_published === true && (
                            <Check className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                        <Badge
                          variant={selectedFilters.is_published === false ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedFilters(prev => ({
                              ...prev,
                              is_published: prev.is_published === false ? null : false
                            }));
                          }}
                        >
                          Draft
                          {selectedFilters.is_published === false && (
                            <Check className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    </div>
                    {/* Collection Filter */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Collection</h4>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                        value={selectedFilters.collection_id || ''}
                        onChange={e => setSelectedFilters(prev => ({ ...prev, collection_id: e.target.value || null }))}
                      >
                        <option value="">All Collections</option>
                        {collections.map(col => (
                          <option key={col.id} value={col.id}>{getCollectionLabel(col, collections)}</option>
                        ))}
                      </select>
                    </div>
                    {/* Clear Filters */}
                    {(selectedFilters.is_published !== null || selectedFilters.collection_id) && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setSelectedFilters({ is_published: null, collection_id: null })}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {/* Add New Plant Button */}
              <Button
                onClick={() => setShowNewPlantForm(true)}
                className="h-12 w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add New Plant</span>
              </Button>
            </div>
            {/* Active Filters Display */}
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedFilters.is_published !== null && (
                <Badge variant="secondary">
                  Status: {selectedFilters.is_published ? 'Published' : 'Draft'}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedFilters(prev => ({ ...prev, is_published: null }))}
                  />
                </Badge>
              )}
              {selectedFilters.collection_id && (
                <Badge variant="secondary">
                  {(() => {
                    const col = collections.find(c => String(c.id) === String(selectedFilters.collection_id));
                    if (!col) {
                      return <span className="flex items-center"><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></span>Loading...</span>;
                    }
                    return col.name;
                  })()}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={() => setSelectedFilters(prev => ({ ...prev, collection_id: null }))}
                  />
                </Badge>
              )}
            </div>
          </div>

          {/* Loading indicator for search */}
          {isSearching && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            </div>
          )}

          {/* Plants List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredPlants.map((plant) => (
                <div 
                  key={plant.id} 
                  className="p-6"
                >
                  <div className="flex items-start gap-6">
                    {/* Plant Image */}
                    <div className="w-32 h-32 flex-shrink-0">
                      {plant.plant_images?.[0] ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${plant.plant_images[0].path}`}
                          alt={buildFullPlantName(plant)}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                          <Image className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">No image</span>
                        </div>
                      )}
                    </div>

                    {/* Plant Details */}
                    <div className="flex-1 min-w-0">
                      {editingPlant?.id === plant.id ? (
                        <Card className="border-0 shadow-none">
                          <CardContent className="p-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="common_name">Common Name</Label>
                                <Input
                                  id="common_name"
                                  value={editingPlant.common_name || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, common_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="genus">Genus</Label>
                                <Input
                                  id="genus"
                                  value={editingPlant.genus || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, genus: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="species">Species</Label>
                                <Input
                                  id="species"
                                  value={editingPlant.species || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, species: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="specific_epithet">Specific Epithet</Label>
                                <Input
                                  id="specific_epithet"
                                  value={editingPlant.specific_epithet || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, specific_epithet: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="hybrid_marker">Hybrid Marker</Label>
                                <Input
                                  id="hybrid_marker"
                                  value={editingPlant.hybrid_marker || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, hybrid_marker: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="hybrid_marker_position">Hybrid Marker Position</Label>
                                <select
                                  id="hybrid_marker_position"
                                  value={editingPlant.hybrid_marker_position || 'none'}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, hybrid_marker_position: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                                >
                                  <option value="none">None</option>
                                  <option value="before_genus">Before Genus</option>
                                  <option value="between_genus_species">Between Genus and Species</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="infraspecies_rank">Infraspecies Rank</Label>
                                <Input
                                  id="infraspecies_rank"
                                  value={editingPlant.infraspecies_rank || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, infraspecies_rank: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="infraspecies_epithet">Infraspecies Epithet</Label>
                                <Input
                                  id="infraspecies_epithet"
                                  value={editingPlant.infraspecies_epithet || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, infraspecies_epithet: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="subspecies">Subspecies</Label>
                                <Input
                                  id="subspecies"
                                  value={editingPlant.subspecies || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, subspecies: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="variety">Variety</Label>
                                <Input
                                  id="variety"
                                  value={editingPlant.variety || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, variety: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="cultivar">Cultivar</Label>
                                <Input
                                  id="cultivar"
                                  value={editingPlant.cultivar || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, cultivar: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="native_to">Native To</Label>
                                <Input
                                  id="native_to"
                                  value={editingPlant.native_to || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, native_to: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="bloom_period">Bloom Period</Label>
                                <Input
                                  id="bloom_period"
                                  value={editingPlant.bloom_period || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, bloom_period: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                  id="slug"
                                  value={editingPlant.slug || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, slug: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="default_collection_id">Default Collection ID</Label>
                                <Input
                                  id="default_collection_id"
                                  type="number"
                                  value={editingPlant.default_collection_id || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, default_collection_id: e.target.value ? parseInt(e.target.value) : null })}
                                />
                              </div>
                              <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                  id="description"
                                  value={editingPlant.description || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, description: e.target.value })}
                                  rows={3}
                                />
                              </div>
                              <div className="space-y-2 sm:col-span-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="is_published"
                                    checked={editingPlant.is_published}
                                    onChange={(e) => setEditingPlant({ ...editingPlant, is_published: e.target.checked })}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <Label htmlFor="is_published">Published</Label>
                                </div>
                              </div>
                            </div>

                            {/* Image Management Section */}
                            <div className="pt-6 border-t">
                              <Label className="text-base font-semibold mb-4 block">Plant Images</Label>
                              <PlantImageManager
                                plantId={editingPlant.id}
                                plantName={buildFullPlantName(editingPlant)}
                                genus={editingPlant.genus}
                                specific_epithet={editingPlant.specific_epithet}
                                infraspecies_rank={editingPlant.infraspecies_rank}
                                variety={editingPlant.variety}
                                cultivar={editingPlant.cultivar}
                                supabase={supabase}
                                onImagesChange={() => fetchPlants()}
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                variant="outline"
                                onClick={() => setEditingPlant(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleSave(editingPlant)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Save Changes
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {buildFullPlantName(plant)}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              plant.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {plant.is_published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {plant.common_name}
                          </p>
                          {expandedPlant === plant.id && (
                            <div className="mt-4 space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium text-gray-500">Family:</span>
                                  <span className="ml-2 text-gray-900">{plant.family}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Native To:</span>
                                  <span className="ml-2 text-gray-900">{plant.native_to}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500">Bloom Period:</span>
                                  <span className="ml-2 text-gray-900">{plant.bloom_period}</span>
                                </div>
                                {plant.specific_epithet && (
                                  <div>
                                    <span className="font-medium text-gray-500">Specific Epithet:</span>
                                    <span className="ml-2 text-gray-900">{plant.specific_epithet}</span>
                                  </div>
                                )}
                                {plant.infraspecies_rank && (
                                  <div>
                                    <span className="font-medium text-gray-500">Infraspecies Rank:</span>
                                    <span className="ml-2 text-gray-900">{plant.infraspecies_rank}</span>
                                  </div>
                                )}
                                {plant.infraspecies_epithet && (
                                  <div>
                                    <span className="font-medium text-gray-500">Infraspecies Epithet:</span>
                                    <span className="ml-2 text-gray-900">{plant.infraspecies_epithet}</span>
                                  </div>
                                )}
                              </div>
                              {plant.description && (
                                <div className="mt-2">
                                  <span className="font-medium text-gray-500">Description:</span>
                                  <p className="mt-1 text-gray-900">{plant.description}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Global Sightings Row */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-gray-600 font-medium">Global Sightings:</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateGlobalSighting(plant.id, -1)}
                              disabled={(globalSightings[plant.id] || 0) <= 0}
                              aria-label="Decrease global sightings"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="text-base font-semibold min-w-[2ch] text-center">
                              {globalSightings[plant.id] ?? 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateGlobalSighting(plant.id, 1)}
                              aria-label="Increase global sightings"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-start gap-1">
                      {editingPlant?.id !== plant.id && (
                        <>
                          {user && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleFavorite(plant)}
                              className={favorites.has(plant.id) ? 'text-red-500' : 'text-gray-400'}
                            >
                              <Star className={`w-5 h-5 ${favorites.has(plant.id) ? 'fill-current' : ''}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(plant)}
                          >
                            <Edit className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(plant.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
                          >
                            {expandedPlant === plant.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <PaginationControls />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PlantsDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
} 