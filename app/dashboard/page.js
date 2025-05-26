'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PlantImageManager from '../components/PlantImageManager';
import BulkImageUpload from '../components/BulkImageUpload';
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
  Edit,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Header from '../components/Header';
import AuthModal from '../components/AuthModal';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Footer from '../components/Footer';

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
  return [
    plant.genus,
    plant.specific_epithet,
    plant.infraspecies_rank,
    plant.infraspecies_epithet,
    plant.variety,
    plant.cultivar
  ]
    .map(clean)
    .filter(Boolean)
    .join(' ');
}

export default function PlantsDashboard() {
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user: authUser } = useAuth();
  const router = useRouter();

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

  const fetchPlants = async () => {
    try {
      // First, get the total count
      const { count, error: countError } = await supabase
        .from('plants')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count);
      setTotalPages(Math.ceil(count / pageSize));

      // Then fetch the paginated data
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
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, [currentPage, pageSize]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You must be an administrator to access this page.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Plants Dashboard</h1>
              {user && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    showFavoritesOnly 
                      ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`w-5 h-5 ${showFavoritesOnly ? 'fill-red-400' : ''}`} />
                  {showFavoritesOnly ? 'Show All' : 'Show Favorites'}
                </button>
              )}
            </div>
            <button
              onClick={() => setShowNewPlantForm(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              Add New Plant
            </button>
          </div>

          {/* New Plant Form */}
          {showNewPlantForm && (
            <div className="mb-8 p-4 sm:p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Add New Plant</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="common_name">Common Name</Label>
                  <Input
                    id="common_name"
                    placeholder="Common Name"
                    value={newPlant.common_name || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, common_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="family">Family</Label>
                  <Input
                    id="family"
                    placeholder="Family"
                    value={newPlant.family || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, family: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genus">Genus</Label>
                  <Input
                    id="genus"
                    placeholder="Genus"
                    value={newPlant.genus || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, genus: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="species">Species</Label>
                  <Input
                    id="species"
                    placeholder="Species"
                    value={newPlant.species || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, species: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specific_epithet">Specific Epithet</Label>
                  <Input
                    id="specific_epithet"
                    placeholder="Specific Epithet"
                    value={newPlant.specific_epithet || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, specific_epithet: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subspecies">Subspecies</Label>
                  <Input
                    id="subspecies"
                    placeholder="Subspecies"
                    value={newPlant.subspecies || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, subspecies: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variety">Variety</Label>
                  <Input
                    id="variety"
                    placeholder="Variety"
                    value={newPlant.variety || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, variety: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cultivar">Cultivar</Label>
                  <Input
                    id="cultivar"
                    placeholder="Cultivar"
                    value={newPlant.cultivar || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, cultivar: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="native_to">Native To</Label>
                  <Input
                    id="native_to"
                    placeholder="Native To"
                    value={newPlant.native_to || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, native_to: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloom_period">Bloom Period</Label>
                  <Input
                    id="bloom_period"
                    placeholder="Bloom Period"
                    value={newPlant.bloom_period || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, bloom_period: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="Slug"
                    value={newPlant.slug || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, slug: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_collection_id">Default Collection ID</Label>
                  <Input
                    id="default_collection_id"
                    type="number"
                    value={newPlant.default_collection_id || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, default_collection_id: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Description"
                    value={newPlant.description || ''}
                    onChange={(e) => setNewPlant({ ...newPlant, description: e.target.value })}
                    rows="3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
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
                                  value={editingPlant.hybrid_marker_position || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, hybrid_marker_position: e.target.value })}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                                >
                                  <option value="none">None</option>
                                  <option value="genus">Genus</option>
                                  <option value="species">Species</option>
                                  <option value="infraspecies">Infraspecies</option>
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
                                <Label htmlFor="family">Family</Label>
                                <Input
                                  id="family"
                                  value={editingPlant.family || ''}
                                  onChange={(e) => setEditingPlant({ ...editingPlant, family: e.target.value })}
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