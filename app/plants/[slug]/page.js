'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Star, Leaf, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { use } from 'react';
import { buildFullPlantName, renderPlantName } from '../../utils/plantNameUtils';

export default function PlantDetailPage({ params }) {
  const slug = use(params).slug;
  const [plant, setPlant] = useState(null);
  const [collections, setCollections] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { user: authUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchPlant();
    fetchCollections();
    if (authUser) {
      fetchFavorites();
    }
  }, [slug, authUser]);

  const fetchPlant = async () => {
    try {
      const { data, error } = await supabase
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
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      setPlant(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching plant:', err);
      setLoading(false);
    }
  };

  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('id, name, is_published')
        .eq('is_published', true);

      if (error) throw error;
      setCollections(data || []);
    } catch (err) {
      console.error('Error fetching collections:', err);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('plant_id')
        .eq('user_id', authUser.id);

      if (error) throw error;
      setFavorites(new Set(data.map(f => f.plant_id)));
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  const toggleFavorite = async () => {
    if (!authUser) {
      router.push('/login');
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
      console.error('Error toggling favorite:', err);
    }
  };

  const getCollectionNames = (plant) => {
    const collectionIds = plant.collection_plants?.map(cp => cp.collection_id) || [];
    return collections
      .filter(c => collectionIds.includes(c.id))
      .map(c => c.name);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === plant.plant_images.length - 1 ? 0 : prev + 1
    );
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? plant.plant_images.length - 1 : prev - 1
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Plant Not Found</h1>
            <p className="mt-2 text-gray-600">The plant you're looking for doesn't exist or isn't published.</p>
            <Button
              onClick={() => router.push('/plants')}
              className="mt-4"
            >
              Back to Plants
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/plants')}
          className="mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Plants
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square relative bg-white rounded-lg overflow-hidden">
              {plant.plant_images?.[currentImageIndex] ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${plant.plant_images[currentImageIndex].path}`}
                  alt={renderPlantName(plant)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Leaf className="w-12 h-12 text-gray-400" />
                </div>
              )}
              {plant.plant_images?.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={previousImage}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={nextImage}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                onClick={toggleFavorite}
              >
                <Star 
                  className={`w-5 h-5 ${favorites.has(plant.id) ? 'fill-current text-yellow-500' : 'text-gray-400'}`} 
                />
              </Button>
            </div>
            {plant.plant_images?.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {plant.plant_images.map((image, index) => (
                  <button
                    key={image.id}
                    className={`aspect-square rounded-lg overflow-hidden ${
                      index === currentImageIndex ? 'ring-2 ring-green-500' : ''
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                  >
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${image.path}`}
                      alt={`${renderPlantName(plant)} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plant Information */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                <div className="flex items-center space-x-2">
                  {renderPlantName(plant)}
                </div>
              </h1>
              {plant.common_name && (
                <p className="text-xl text-gray-600 mt-2">{plant.common_name}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {getCollectionNames(plant).map((name, index) => (
                <Badge key={index} variant="secondary">
                  {name}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {plant.family && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Family</h3>
                  <p className="mt-1 text-gray-900" dangerouslySetInnerHTML={{ __html: `<i>${plant.family}</i>` }}></p>
                </div>
              )}
              {plant.native_to && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Native To</h3>
                  <p className="mt-1 text-gray-900">{plant.native_to}</p>
                </div>
              )}
              {plant.bloom_period && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Bloom Period</h3>
                  <p className="mt-1 text-gray-900">{plant.bloom_period}</p>
                </div>
              )}
              {plant.hybrid_marker && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Hybrid</h3>
                  <p className="mt-1 text-gray-900">Yes</p>
                </div>
              )}
            </div>

            {plant.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-gray-900">{plant.description}</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 