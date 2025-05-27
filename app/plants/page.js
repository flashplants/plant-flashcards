'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Star, Leaf } from 'lucide-react';
import { Button } from "../../components/ui/button";

// Reuse the buildFullPlantName and renderPlantName functions from dashboard
function buildFullPlantName(plant) {
  let nameParts = [];
  
  if (plant.hybrid_marker === 'x') {
    if (plant.hybrid_marker_position === 'before_genus') {
      nameParts.push({ text: 'x', italic: false });
    }
  }
  
  if (plant.genus) {
    nameParts.push({ text: plant.genus, italic: true });
  }
  
  if (plant.hybrid_marker === 'x' && plant.hybrid_marker_position === 'between_genus_species') {
    nameParts.push({ text: 'x', italic: false });
  }
  
  if (plant.specific_epithet) {
    nameParts.push({ text: plant.specific_epithet, italic: true });
  }

  if (plant.infraspecies_rank && plant.infraspecies_epithet) {
    const rank = plant.infraspecies_rank === 'subsp.' ? 'ssp.' : plant.infraspecies_rank;
    nameParts.push({ text: rank, italic: false });
    nameParts.push({ text: plant.infraspecies_epithet, italic: true });
  }

  if (plant.variety) {
    nameParts.push({ text: 'var.', italic: false });
    nameParts.push({ text: plant.variety, italic: true });
  }

  if (plant.cultivar) {
    nameParts.push({ text: `'${plant.cultivar}'`, italic: false });
  }

  let result = [];
  
  let scientificNameParts = nameParts.map(part => {
    if (typeof part === 'string') {
      return part;
    }
    return part.italic ? `<i>${part.text}</i>` : part.text;
  });
  result.push({ text: scientificNameParts.join(' '), italic: false });

  if (plant.common_name) {
    result.push(plant.common_name);
  }

  if (plant.family) {
    result.push({ text: plant.family, italic: true });
  }

  return result;
}

const renderPlantName = (plant) => {
  const parts = buildFullPlantName(plant);
  return parts.map((part, index) => (
    <span key={index}>
      {typeof part === 'string' ? (
        <>
          {part}
          {index < parts.length - 1 ? ',' : ''}
        </>
      ) : (
        <>
          <span dangerouslySetInnerHTML={{ __html: part.italic ? `<i>${part.text}</i>` : part.text }} />
          {index < parts.length - 1 ? ',' : ''}
        </>
      )}
      {index < parts.length - 1 ? ' ' : ''}
    </span>
  ));
};

export default function PlantsPage() {
  const [plants, setPlants] = useState([]);
  const [collections, setCollections] = useState([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchPlants();
    fetchCollections();
    if (authUser) {
      fetchFavorites();
    }
  }, [authUser]);

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
          ),
          collection_plants (
            collection_id
          )
        `)
        .eq('is_published', true)
        .order('scientific_name');

      if (error) throw error;
      setPlants(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching plants:', err);
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

  const toggleFavorite = async (plant) => {
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
          <h1 className="text-3xl font-bold text-gray-900">Plants</h1>
          <p className="mt-2 text-gray-600">Browse our collection of plants</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plants.map((plant) => (
            <Card 
              key={plant.id}
              className="overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              onClick={() => router.push(`/plants/${plant.slug}`)}
            >
              <div className="aspect-square relative">
                {plant.plant_images?.[0] ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${plant.plant_images[0].path}`}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {renderPlantName(plant)}
                </h3>
                {plant.common_name && (
                  <p className="text-sm text-gray-600 mb-3">{plant.common_name}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {getCollectionNames(plant).map((name, index) => (
                    <Badge key={index} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
} 