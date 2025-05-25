'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Image as ImageIcon,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Heart
} from 'lucide-react';
import Header from '../components/Header';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PlantsDashboard() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPlant, setEditingPlant] = useState(null);
  const [newPlant, setNewPlant] = useState({
    scientific_name: '',
    common_name: '',
    family: '',
    native_to: '',
    bloom_period: '',
    description: '',
    is_published: true
  });
  const [showNewPlantForm, setShowNewPlantForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedPlant, setExpandedPlant] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkUser();
    fetchPlants();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchUserData = async () => {
    // Fetch user's favorites
    const { data: favData } = await supabase
      .from('favorites')
      .select('plant_id')
      .eq('user_id', user.id);
    
    if (favData) {
      setFavorites(new Set(favData.map(f => f.plant_id)));
    }
  };

  const fetchPlants = async () => {
    try {
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
        .order('scientific_name');

      if (error) throw error;
      setPlants(data || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

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
          native_to: plant.native_to,
          bloom_period: plant.bloom_period,
          description: plant.description,
          is_published: plant.is_published
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
        native_to: '',
        bloom_period: '',
        description: '',
        is_published: true
      });
      fetchPlants();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImageUpload = async (plantId, file) => {
    try {
      setUploadingImage(true);
      
      // Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${plantId}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('plant-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create plant_image record
      const { error: dbError } = await supabase
        .from('plant_images')
        .insert({
          plant_id: plantId,
          path: fileName,
          is_primary: true
        });

      if (dbError) throw dbError;

      fetchPlants();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleFavorite = async (plant) => {
    if (!user) {
      alert('Please log in to add favorites');
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
      alert(err.message);
    }
  };

  const filteredPlants = showFavoritesOnly 
    ? plants.filter(plant => favorites.has(plant.id))
    : plants;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <Heart className={`w-5 h-5 ${showFavoritesOnly ? 'fill-red-400' : ''}`} />
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
              <input
                type="text"
                placeholder="Scientific Name"
                value={newPlant.scientific_name}
                onChange={(e) => setNewPlant({ ...newPlant, scientific_name: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Common Name"
                value={newPlant.common_name}
                onChange={(e) => setNewPlant({ ...newPlant, common_name: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Family"
                value={newPlant.family}
                onChange={(e) => setNewPlant({ ...newPlant, family: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Native To"
                value={newPlant.native_to}
                onChange={(e) => setNewPlant({ ...newPlant, native_to: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Bloom Period"
                value={newPlant.bloom_period}
                onChange={(e) => setNewPlant({ ...newPlant, bloom_period: e.target.value })}
                className="p-2 border rounded"
              />
              <textarea
                placeholder="Description"
                value={newPlant.description}
                onChange={(e) => setNewPlant({ ...newPlant, description: e.target.value })}
                className="p-2 border rounded sm:col-span-2"
                rows="3"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewPlantForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create Plant
              </button>
            </div>
          </div>
        )}

        {/* Plants List - Mobile Optimized */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredPlants.map((plant) => (
              <div key={plant.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      {editingPlant?.id === plant.id ? (
                        <label className="w-full h-full flex items-center justify-center bg-gray-100 rounded cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(plant.id, e.target.files[0])}
                            className="hidden"
                          />
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        </label>
                      ) : (
                        plant.plant_images?.[0] ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${plant.plant_images[0].path}`}
                            alt={plant.scientific_name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {editingPlant?.id === plant.id ? (
                          <input
                            type="text"
                            value={editingPlant.scientific_name}
                            onChange={(e) => setEditingPlant({ ...editingPlant, scientific_name: e.target.value })}
                            className="p-1 border rounded w-full"
                          />
                        ) : (
                          plant.scientific_name
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {editingPlant?.id === plant.id ? (
                          <input
                            type="text"
                            value={editingPlant.common_name}
                            onChange={(e) => setEditingPlant({ ...editingPlant, common_name: e.target.value })}
                            className="p-1 border rounded w-full"
                          />
                        ) : (
                          plant.common_name
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPlant?.id === plant.id ? (
                      <>
                        <button
                          onClick={() => handleSave(editingPlant)}
                          className="p-2 text-green-600 hover:text-green-900"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingPlant(null)}
                          className="p-2 text-gray-600 hover:text-gray-900"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {user && (
                          <button
                            onClick={() => toggleFavorite(plant)}
                            className={`p-2 ${favorites.has(plant.id) ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}
                          >
                            <Heart className={`w-5 h-5 ${favorites.has(plant.id) ? 'fill-current' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(plant)}
                          className="p-2 text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(plant.id)}
                          className="p-2 text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setExpandedPlant(expandedPlant === plant.id ? null : plant.id)}
                          className="p-2 text-gray-600 hover:text-gray-900"
                        >
                          {expandedPlant === plant.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPlant === plant.id && (
                  <div className="mt-4 pl-20 space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Family:</span>
                      <span className="ml-2 text-sm text-gray-900">{plant.family}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Native To:</span>
                      <span className="ml-2 text-sm text-gray-900">{plant.native_to}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Bloom Period:</span>
                      <span className="ml-2 text-sm text-gray-900">{plant.bloom_period}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        plant.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plant.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    {plant.description && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Description:</span>
                        <p className="mt-1 text-sm text-gray-900">{plant.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 