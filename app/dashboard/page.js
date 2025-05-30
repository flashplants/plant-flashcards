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
  Search,
  FolderPlus,
  FolderEdit,
  FolderMinus
} from 'lucide-react';
import { buildFullPlantName, renderPlantName } from '../utils/plantNameUtils';

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

// Helper function to generate a slug from a name
const generateSlug = async (name) => {
  // Convert name to lowercase and replace spaces with hyphens
  let baseSlug = name.toLowerCase().replace(/\s+/g, '-');
  
  // Remove any characters that aren't letters, numbers, or hyphens
  baseSlug = baseSlug.replace(/[^a-z0-9-]/g, '');
  
  // Start with the base slug
  let slug = baseSlug;
  let counter = 1;
  
  // Keep trying until we find a unique slug
  while (true) {
    // Check if this slug exists
    const { data, error } = await supabase
      .from('collections')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();
    
    // If no record found or error occurred, we can use this slug
    if (error || !data) {
      return slug;
    }
    
    // If we found a record, try the next number
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// Add this helper function near the top with other helper functions
const generatePlantSlug = async (plant, existingPlants = []) => {
  // Build the base slug from the plant's scientific name
  let baseSlug = [plant.genus, plant.specific_epithet, plant.infraspecies_rank, plant.infraspecies_epithet, plant.variety, plant.cultivar]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  
  // Check if the slug already exists in the database
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const { data, error } = await supabase
      .from('plants')
      .select('slug')
      .eq('slug', slug)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No matching slug found, we can use this one
      break;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
};

// Helper to get unique collection labels
const getCollectionLabel = (col, allCollections) => {
  const nameCount = allCollections.filter(c => c.name === col.name).length;
  return nameCount > 1 ? `${col.name} (ID: ${col.id})` : col.name;
};

const getCollectionName = (id, allCollections) => {
  const col = allCollections.find(c => c.id === id);
  return col ? col.name : 'Collection';
};

function DashboardContent({ user, authUser, showAuth, setShowAuth }) {
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
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const [globalSightings, setGlobalSightings] = useState({});
  const [userSightings, setUserSightings] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({
    is_published: null,
    collection_id: null
  });
  const [showCollections, setShowCollections] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    is_published: false
  });
  const [showAdminPlants, setShowAdminPlants] = useState(true);
  const [showAdminCollections, setShowAdminCollections] = useState(true);
  const [showAdminSightings, setShowAdminSightings] = useState(true);

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
        setIsAdmin(profile?.is_admin || false);
        fetchPlants();
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

  // Fetch user sightings counts for all plants on page
  const fetchUserSightings = useCallback(async (plantIds) => {
    if (!plantIds.length || !authUser) return;
    const { data, error } = await supabase
      .from('sightings')
      .select('plant_id')
      .eq('user_id', authUser.id)
      .in('plant_id', plantIds);
    if (!error && data) {
      const counts = {};
      // Count occurrences of each plant_id
      data.forEach(row => {
        counts[row.plant_id] = (counts[row.plant_id] || 0) + 1;
      });
      setUserSightings(counts);
    }
  }, [authUser]);

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
      let query = supabase
        .from('collections')
        .select('id, name, description, is_published, user_id, is_admin_collection')
        .order('name');

      // If admin, only show admin collections
      if (isAdmin) {
        query = query.eq('is_admin_collection', true);
      } else {
        // If regular user, show their own collections and admin collections
        query = query.or(`user_id.eq.${authUser.id},is_admin_collection.eq.true`);
      }

      const { data, error } = await query;
      if (!error && data) {
        // Ensure all collections have the correct boolean values
        const formattedCollections = data.map(collection => ({
          ...collection,
          is_published: Boolean(collection.is_published),
          is_admin_collection: Boolean(collection.is_admin_collection)
        }));
        setCollections(formattedCollections);
      }
    };
    fetchCollections();
  }, [isAdmin, authUser]);

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
            ),
            collection_plants!inner (
              collection_id
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
            setUserSightings({});
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
          if (!isAdmin) {
            fetchUserSightings(data.map(p => p.id));
          }
        } else {
          setGlobalSightings({});
          setUserSightings({});
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
      if (!authUser) {
        setPlants([]);
        setLoading(false);
        return;
      }

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
          let queryBuilder = supabase
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
            .in('id', pagedPlantIds)
            .order('scientific_name');

          // Add published status filter if selected
          if (selectedFilters.is_published !== null) {
            queryBuilder = queryBuilder.eq('is_published', selectedFilters.is_published);
          }

          const { data, error } = await queryBuilder;
          if (error) throw error;
          setPlants(data || []);
          setLoading(false);
          if (data && data.length) {
            fetchGlobalSightings(data.map(p => p.id));
            if (!isAdmin) {
              fetchUserSightings(data.map(p => p.id));
            }
          } else {
            setGlobalSightings({});
            setUserSightings({});
          }
          return;
        } else {
          setPlants([]);
          setGlobalSightings({});
          setUserSightings({});
          setTotalCount(0);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }
      // Default: fetch all plants paginated
      let queryBuilder = supabase
        .from('plants')
        .select('*', { count: 'exact', head: true });

      // Add published status filter if selected
      if (selectedFilters.is_published !== null) {
        queryBuilder = queryBuilder.eq('is_published', selectedFilters.is_published);
      }

      // If not admin, only show user's own plants and admin plants
      if (!isAdmin) {
        queryBuilder = queryBuilder.or(`user_id.eq.${authUser.id},is_admin_plant.eq.true`);
      }

      const { count, error: countError } = await queryBuilder;
      if (countError) throw countError;
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));

      // Fetch the actual plants
      let plantsQuery = supabase
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
        .order('scientific_name')
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      // Add published status filter if selected
      if (selectedFilters.is_published !== null) {
        plantsQuery = plantsQuery.eq('is_published', selectedFilters.is_published);
      }

      // If not admin, only show user's own plants and admin plants
      if (!isAdmin) {
        plantsQuery = plantsQuery.or(`user_id.eq.${authUser.id},is_admin_plant.eq.true`);
      }

      const { data, error } = await plantsQuery;
      if (error) throw error;
      setPlants(data || []);
      setLoading(false);
      if (data && data.length) {
        fetchGlobalSightings(data.map(p => p.id));
        if (!isAdmin) {
          fetchUserSightings(data.map(p => p.id));
        }
      } else {
        setGlobalSightings({});
        setUserSightings({});
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
    // Prevent non-admin users from editing admin plants
    if (plant.is_admin_plant && !isAdmin) {
      alert('You do not have permission to edit admin plants.');
      return;
    }
    // Get the collection_id from collection_plants if it exists
    const collectionId = plant.collection_plants?.[0]?.collection_id || null;
    setEditingPlant({ 
      ...plant,
      collection_id: collectionId
    });
  };

  const handleSave = async (plant) => {
    try {
      // Validate required fields
      if (!plant.genus || !plant.family) {
        alert('Genus and Family are required fields');
        return;
      }

      // Start a transaction
      const { error: updateError } = await supabase
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
          default_collection_id: plant.default_collection_id,
          user_id: authUser.id,
          is_admin_plant: isAdmin
        })
        .eq('id', plant.id);

      if (updateError) throw updateError;

      // Handle collection assignment
      if (plant.collection_id) {
        // First, remove any existing collection assignments
        await supabase
          .from('collection_plants')
          .delete()
          .eq('plant_id', plant.id);

        // Then add the new collection assignment
        const { error: collectionError } = await supabase
          .from('collection_plants')
          .insert({
            collection_id: plant.collection_id,
            plant_id: plant.id
          });

        if (collectionError) throw collectionError;
      } else {
        // If no collection selected, remove any existing assignments
        await supabase
          .from('collection_plants')
          .delete()
          .eq('plant_id', plant.id);
      }

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
      // Validate required fields
      if (!newPlant.genus || !newPlant.family) {
        alert('Genus and Family are required fields');
        return;
      }

      // Generate a slug for the plant
      const slug = await generatePlantSlug(newPlant, plants);

      // Insert the plant
      const { data: plantData, error: insertError } = await supabase
        .from('plants')
        .insert([{
          ...newPlant,
          slug,
          user_id: authUser.id,
          is_admin_plant: isAdmin
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Handle collection assignment if selected
      if (newPlant.collection_id && plantData) {
        const { error: collectionError } = await supabase
          .from('collection_plants')
          .insert({
            collection_id: newPlant.collection_id,
            plant_id: plantData.id
          });

        if (collectionError) throw collectionError;
      }

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
        default_collection_id: null,
        collection_id: null
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

  // Filtered plants based on admin plant preference
  const filteredPlants = showFavoritesOnly 
    ? plants.filter(plant => favorites.has(plant.id))
    : plants.filter(plant => showAdminPlants || !plant.is_admin_plant || plant.user_id === authUser?.id);

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

  // Add user sighting update function
  const updateUserSighting = async (plantId, delta) => {
    const current = userSightings[plantId] || 0;
    const newCount = Math.max(0, current + delta);
    setUserSightings(prev => ({ ...prev, [plantId]: newCount })); // Optimistic
    let error = null;
    if (delta > 0) {
      // Insert a new row into sightings
      ({ error } = await supabase
        .from('sightings')
        .insert({ plant_id: plantId, user_id: authUser.id }));
    } else if (delta < 0 && current > 0) {
      // Delete one row for this plant_id (the oldest)
      const { data: rows, error: fetchError } = await supabase
        .from('sightings')
        .select('id')
        .eq('plant_id', plantId)
        .eq('user_id', authUser.id)
        .order('id', { ascending: true })
        .limit(1);
      if (!fetchError && rows && rows.length > 0) {
        const rowId = rows[0].id;
        ({ error } = await supabase
          .from('sightings')
          .delete()
          .eq('id', rowId));
      } else {
        error = fetchError || new Error('No sighting row to delete');
      }
    }
    // Always re-fetch counts after change
    await fetchUserSightings(plants.map(p => p.id));
    if (error) {
      // Revert on error
      setUserSightings(prev => ({ ...prev, [plantId]: current }));
      alert('Failed to update sightings: ' + (error.message || error));
    }
  };

  const handleCreateCollection = async () => {
    try {
      if (!newCollection.name.trim()) {
        alert('Collection name is required');
        return;
      }

      // Start with base slug
      let baseSlug = newCollection.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      let slug = baseSlug;
      let counter = 1;
      let success = false;
      let data;

      // Keep trying until we succeed
      while (!success) {
        try {
          const result = await supabase
            .from('collections')
            .insert([{
              ...newCollection,
              is_published: Boolean(newCollection.is_published),
              user_id: authUser.id,
              is_admin_collection: isAdmin,
              slug: slug
            }])
            .select()
            .single();

          if (result.error) throw result.error;
          
          data = result.data;
          success = true;
        } catch (err) {
          // If it's a unique constraint violation, try the next number
          if (err.code === '23505' && err.message.includes('collections_slug_key')) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          } else {
            // If it's any other error, throw it
            throw err;
          }
        }
      }

      // Ensure the new collection has the correct boolean values
      const formattedCollection = {
        ...data,
        is_published: Boolean(data.is_published),
        is_admin_collection: Boolean(data.is_admin_collection)
      };

      setCollections(prev => [...prev, formattedCollection]);
      setNewCollection({
        name: '',
        description: '',
        is_published: false
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditCollection = async (collection) => {
    try {
      if (!collection.name.trim()) {
        alert('Collection name is required');
        return;
      }

      // Prevent non-admin users from editing admin collections
      if (collection.is_admin_collection && !isAdmin) {
        alert('You do not have permission to edit admin collections.');
        return;
      }

      // Only generate a new slug if the name has changed
      const existingCollection = collections.find(c => c.id === collection.id);
      const slug = existingCollection?.name !== collection.name 
        ? await generateSlug(collection.name, collections.filter(c => c.id !== collection.id))
        : existingCollection.slug;

      const { error } = await supabase
        .from('collections')
        .update({
          name: collection.name,
          description: collection.description || '',
          is_published: Boolean(collection.is_published),
          is_admin_collection: isAdmin ? collection.is_admin_collection : false,
          slug: slug
        })
        .eq('id', collection.id);

      if (error) throw error;

      // Ensure the updated collection has the correct boolean values
      const formattedCollection = {
        ...collection,
        is_published: Boolean(collection.is_published),
        is_admin_collection: isAdmin ? Boolean(collection.is_admin_collection) : false,
        slug: slug
      };

      setCollections(prev => prev.map(c => 
        c.id === collection.id ? formattedCollection : c
      ));
      setEditingCollection(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    // Prevent non-admin users from deleting admin collections
    const collection = collections.find(c => c.id === collectionId);
    if (collection?.is_admin_collection && !isAdmin) {
      alert('You do not have permission to delete admin collections.');
      return;
    }

    if (!confirm('Are you sure you want to delete this collection? This will also remove all plant associations.')) return;

    try {
      // First delete all plant associations
      await supabase
        .from('collection_plants')
        .delete()
        .eq('collection_id', collectionId);

      // Then delete the collection
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;

      setCollections(prev => prev.filter(c => c.id !== collectionId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered collections based on admin collection preference
  const filteredCollections = collections.filter(c => showAdminCollections || !c.is_admin_collection);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!loading && !authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Please Sign In</h2>
            <p className="text-gray-600 mb-4">You need to be signed in to access the dashboard.</p>
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Sign In
            </button>
          </div>
        </div>
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)}
          onSuccess={(user) => {
            setUser(user);
            setAuthUser(user);
          }}
        />
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
            setAuthUser(user);
          }}
        />

        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Plants Dashboard</h1>
              <Button
                onClick={() => setShowCollections(!showCollections)}
                className="flex items-center gap-2"
              >
                {showCollections ? (
                  <>
                    <FolderMinus className="w-5 h-5" />
                    Hide Collections
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-5 h-5" />
                    Manage Collections
                  </>
                )}
              </Button>
            </div>

            {/* Collections Management Section */}
            {showCollections && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Collections</h2>
                
                {/* New Collection Form */}
                <div className="mb-6 p-4 border rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Create New Collection</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="collection-name">Name</Label>
                      <Input
                        id="collection-name"
                        value={newCollection.name}
                        onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter collection name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="collection-description">Description</Label>
                      <Textarea
                        id="collection-description"
                        value={newCollection.description}
                        onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter collection description"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="collection-published"
                        checked={newCollection.is_published}
                        onChange={(e) => setNewCollection(prev => ({ ...prev, is_published: e.target.checked }))}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <Label htmlFor="collection-published">Published</Label>
                    </div>
                    <Button
                      onClick={handleCreateCollection}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Create Collection
                    </Button>
                  </div>
                </div>

                {/* Collections List */}
                <div className="space-y-4">
                  {filteredCollections.map(collection => (
                    <div key={collection.id} className="border rounded-lg p-4">
                      {editingCollection?.id === collection.id ? (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor={`edit-name-${collection.id}`}>Name</Label>
                            <Input
                              id={`edit-name-${collection.id}`}
                              value={editingCollection.name || ''}
                              onChange={(e) => setEditingCollection(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-description-${collection.id}`}>Description</Label>
                            <Textarea
                              id={`edit-description-${collection.id}`}
                              value={editingCollection.description || ''}
                              onChange={(e) => setEditingCollection(prev => ({ ...prev, description: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-published-${collection.id}`}
                              checked={editingCollection.is_published || false}
                              onChange={(e) => setEditingCollection(prev => ({ ...prev, is_published: e.target.checked }))}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <Label htmlFor={`edit-published-${collection.id}`}>Published</Label>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`edit-admin-${collection.id}`}
                                checked={editingCollection.is_admin_collection || false}
                                onChange={(e) => setEditingCollection(prev => ({ ...prev, is_admin_collection: e.target.checked }))}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <Label htmlFor={`edit-admin-${collection.id}`}>Admin Collection</Label>
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setEditingCollection(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleEditCollection(editingCollection)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{collection.name}</h3>
                            {collection.description && (
                              <p className="text-gray-600 mt-1">{collection.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                collection.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {collection.is_published ? 'Published' : 'Draft'}
                              </span>
                              {collection.is_admin_collection ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                  Admin Collection
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  My Collection
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(!collection.is_admin_collection || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingCollection({
                                  ...collection,
                                  name: collection.name || '',
                                  description: collection.description || '',
                                  is_published: collection.is_published || false,
                                  is_admin_collection: collection.is_admin_collection || false
                                })}
                              >
                                <FolderEdit className="w-5 h-5" />
                              </Button>
                            )}
                            {(!collection.is_admin_collection || isAdmin) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCollection(collection.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        {filteredCollections.map(col => (
                          <option key={col.id} value={col.id}>{getCollectionLabel(col, filteredCollections)}</option>
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
                    const col = filteredCollections.find(c => String(c.id) === String(selectedFilters.collection_id));
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
            {/* New Plant Form */}
            {showNewPlantForm && (
              <div className="p-6 border-b">
                <Card className="border-0 shadow-none">
                  <CardContent className="p-0 space-y-4">
                    <div className="border-b pb-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Add New Plant
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Fill in the plant details below
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Scientific Name Fields */}
                      <div className="space-y-2">
                        <Label htmlFor="new-genus" className="flex items-center gap-1">
                          Genus
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="new-genus"
                          value={newPlant.genus || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, genus: e.target.value })}
                          required
                          className={!newPlant.genus ? "border-red-300 focus:ring-red-500" : ""}
                        />
                        {!newPlant.genus && (
                          <p className="text-sm text-red-500">Genus is required</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-specific_epithet">Specific Epithet</Label>
                        <Input
                          id="new-specific_epithet"
                          value={newPlant.specific_epithet || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, specific_epithet: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="new-hybrid_marker"
                            checked={newPlant.hybrid_marker === 'x'}
                            onChange={(e) => setNewPlant({ 
                              ...newPlant, 
                              hybrid_marker: e.target.checked ? 'x' : '',
                              hybrid_marker_position: e.target.checked ? newPlant.hybrid_marker_position : 'none'
                            })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <Label htmlFor="new-hybrid_marker">Hybrid (x)</Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-hybrid_marker_position">Hybrid Marker Position</Label>
                        <select
                          id="new-hybrid_marker_position"
                          value={newPlant.hybrid_marker_position || 'none'}
                          onChange={(e) => setNewPlant({ ...newPlant, hybrid_marker_position: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2"
                          disabled={!newPlant.hybrid_marker}
                        >
                          <option value="none">None</option>
                          <option value="before_genus">Before Genus</option>
                          <option value="between_genus_species">Between Genus and Species</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-infraspecies_rank">Infraspecies Rank</Label>
                        <select
                          id="new-infraspecies_rank"
                          value={newPlant.infraspecies_rank || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, infraspecies_rank: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2"
                        >
                          <option value="">None</option>
                          <option value="f.">f.</option>
                          <option value="var.">var.</option>
                          <option value="subsp.">subsp.</option>
                          <option value="ssp.">ssp.</option>
                          <option value="Purpureus Group">Purpureus Group</option>
                          <option value="Hybrids">Hybrids</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-infraspecies_epithet">Infraspecies Epithet</Label>
                        <Input
                          id="new-infraspecies_epithet"
                          value={newPlant.infraspecies_epithet || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, infraspecies_epithet: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-variety">Variety</Label>
                        <Input
                          id="new-variety"
                          value={newPlant.variety || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, variety: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-cultivar">Cultivar</Label>
                        <Input
                          id="new-cultivar"
                          value={newPlant.cultivar || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, cultivar: e.target.value })}
                        />
                      </div>

                      {/* Common Name and Family */}
                      <div className="space-y-2">
                        <Label htmlFor="new-common_name">Common Name</Label>
                        <Input
                          id="new-common_name"
                          value={newPlant.common_name || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, common_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-family" className="flex items-center gap-1">
                          Family
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="new-family"
                          value={newPlant.family || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, family: e.target.value })}
                          required
                          className={!newPlant.family ? "border-red-300 focus:ring-red-500" : ""}
                        />
                        {!newPlant.family && (
                          <p className="text-sm text-red-500">Family is required</p>
                        )}
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-2">
                        <Label htmlFor="new-native_to">Native To</Label>
                        <Input
                          id="new-native_to"
                          value={newPlant.native_to || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, native_to: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-bloom_period">Bloom Period</Label>
                        <Input
                          id="new-bloom_period"
                          value={newPlant.bloom_period || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, bloom_period: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-slug">Slug</Label>
                        <Input
                          id="new-slug"
                          value={newPlant.slug || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, slug: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-collection_id">Collection</Label>
                        <select
                          id="new-collection_id"
                          value={newPlant.collection_id || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, collection_id: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2"
                        >
                          <option value="">No Collection</option>
                          {filteredCollections.map(col => (
                            <option key={col.id} value={col.id}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="new-description">Description</Label>
                        <Textarea
                          id="new-description"
                          value={newPlant.description || ''}
                          onChange={(e) => setNewPlant({ ...newPlant, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="new-is_published"
                            checked={newPlant.is_published}
                            onChange={(e) => setNewPlant({ ...newPlant, is_published: e.target.checked })}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <Label htmlFor="new-is_published">Published</Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewPlantForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Create Plant
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
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
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${(plant.plant_images.find(img => img.is_primary) || plant.plant_images[0]).path.startsWith(user?.id) ? 'user-plant-images' : 'plant-images'}/${(plant.plant_images.find(img => img.is_primary) || plant.plant_images[0]).path}`}
                          alt={renderPlantName(plant)}
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
                            <div className="border-b pb-4">
                              <h3 className="text-xl font-semibold text-gray-900">
                                {renderPlantName(editingPlant)}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                Edit plant details below
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Scientific Name Fields */}
                              <div className="space-y-2">
                                <Label htmlFor="genus" className="flex items-center gap-1">
                                  Genus
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="genus"
                                  value={editingPlant.genus || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, genus: e.target.value })}
                                  required
                                  className={!editingPlant.genus ? "border-red-300 focus:ring-red-500" : ""}
                                />
                                {!editingPlant.genus && (
                                  <p className="text-sm text-red-500">Genus is required</p>
                                )}
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
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="hybrid_marker"
                                    checked={editingPlant.hybrid_marker === 'x'}
                                    onChange={(e) => setEditingPlant({ 
                                      ...editingPlant, 
                                      hybrid_marker: e.target.checked ? 'x' : '',
                                      hybrid_marker_position: e.target.checked ? editingPlant.hybrid_marker_position : 'none'
                                    })}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <Label htmlFor="hybrid_marker">Hybrid (x)</Label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="hybrid_marker_position">Hybrid Marker Position</Label>
                                <select
                                  id="hybrid_marker_position"
                                  value={editingPlant.hybrid_marker_position || 'none'}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, hybrid_marker_position: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                                  disabled={!editingPlant.hybrid_marker}
                                >
                                  <option value="none">None</option>
                                  <option value="before_genus">Before Genus</option>
                                  <option value="between_genus_species">Between Genus and Species</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="infraspecies_rank">Infraspecies Rank</Label>
                                <select
                                  id="infraspecies_rank"
                                  value={editingPlant.infraspecies_rank || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, infraspecies_rank: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                                >
                                  <option value="">None</option>
                                  <option value="f.">f.</option>
                                  <option value="var.">var.</option>
                                  <option value="subsp.">subsp.</option>
                                  <option value="ssp.">ssp.</option>
                                  <option value="Purpureus Group">Purpureus Group</option>
                                  <option value="Hybrids">Hybrids</option>
                                </select>
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

                              {/* Common Name and Family */}
                              <div className="space-y-2">
                                <Label htmlFor="common_name">Common Name</Label>
                                <Input
                                  id="common_name"
                                  value={editingPlant.common_name || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, common_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="family" className="flex items-center gap-1">
                                  Family
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="family"
                                  value={editingPlant.family || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, family: e.target.value })}
                                  required
                                  className={!editingPlant.family ? "border-red-300 focus:ring-red-500" : ""}
                                />
                                {!editingPlant.family && (
                                  <p className="text-sm text-red-500">Family is required</p>
                                )}
                              </div>

                              {/* Additional Information */}
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
                                <Label htmlFor="collection_id">Collection</Label>
                                <select
                                  id="collection_id"
                                  value={editingPlant.collection_id || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, collection_id: e.target.value ? parseInt(e.target.value) : null })}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                                >
                                  <option value="">No Collection</option>
                                  {filteredCollections.map(col => (
                                    <option key={col.id} value={col.id}>{col.name}</option>
                                  ))}
                                </select>
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
                                plantName={renderPlantName(editingPlant)}
                                genus={editingPlant.genus}
                                specific_epithet={editingPlant.specific_epithet}
                                infraspecies_rank={editingPlant.infraspecies_rank}
                                variety={editingPlant.variety}
                                cultivar={editingPlant.cultivar}
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
                              {renderPlantName(plant)}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              plant.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {plant.is_published ? 'Published' : 'Draft'}
                            </span>
                            {plant.is_admin_plant ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                Admin Plant
                              </span>
                            ) : plant.user_id === authUser?.id ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                My Plant
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-500">
                            {plant.common_name}
                          </p>
                          {expandedPlant === plant.id && (
                            <div className="mt-4 space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="font-medium text-gray-500">Family:</span>
                                  <span className="ml-2 text-gray-900" dangerouslySetInnerHTML={{ __html: `<i>${plant.family}</i>` }}></span>
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
                          {/* Sightings Row */}
                          <div className="flex items-center gap-2 mt-2">
                            {showAdminSightings && (
                              <span className="text-sm text-gray-600 font-medium">
                                {isAdmin ? 'Global Sightings:' : 'My Sightings:'}
                              </span>
                            )}
                            {showAdminSightings && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => isAdmin ? updateGlobalSighting(plant.id, -1) : updateUserSighting(plant.id, -1)}
                                disabled={(isAdmin ? globalSightings[plant.id] : userSightings[plant.id]) <= 0}
                                aria-label={`Decrease ${isAdmin ? 'global' : 'my'} sightings`}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                            )}
                            {showAdminSightings && (
                              <span className="text-base font-semibold min-w-[2ch] text-center">
                                {isAdmin ? (globalSightings[plant.id] ?? 0) : (userSightings[plant.id] ?? 0)}
                              </span>
                            )}
                            {showAdminSightings && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => isAdmin ? updateGlobalSighting(plant.id, 1) : updateUserSighting(plant.id, 1)}
                                aria-label={`Increase ${isAdmin ? 'global' : 'my'} sightings`}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
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
                              className={favorites.has(plant.id) ? 'text-yellow-500' : 'text-gray-400'}
                            >
                              <Star className={`w-5 h-5 ${favorites.has(plant.id) ? 'fill-current' : ''}`} />
                            </Button>
                          )}
                          {/* Show edit button for user's own plants or for admin plants if user is admin */}
                          {(plant.user_id === authUser?.id || (isAdmin && plant.is_admin_plant)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(plant)}
                            >
                              <Edit className="w-5 h-5" />
                            </Button>
                          )}
                          {/* Show delete button for user's own plants or for admin plants if user is admin */}
                          {(plant.user_id === authUser?.id || (isAdmin && plant.is_admin_plant)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(plant.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          )}
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
  const [user, setUser] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          setAuthUser(user);
        }
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!loading && !authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Please Sign In</h2>
            <p className="text-gray-600 mb-4">You need to be signed in to access the dashboard.</p>
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Sign In
            </button>
          </div>
        </div>
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)}
          onSuccess={(user) => {
            setUser(user);
            setAuthUser(user);
          }}
        />
      </div>
    );
  }

  return <DashboardContent 
    user={user} 
    authUser={authUser} 
    showAuth={showAuth}
    setShowAuth={setShowAuth}
  />;
} 