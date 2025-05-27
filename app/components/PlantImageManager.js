import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle, Image as ImageIcon, File, Star, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Simple Progress component
const Progress = ({ value, className }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-green-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

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
        URL.revokeObjectURL(img.src);
        resolve(blob);
      }, 'image/webp', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
  });
};

// Helper function to generate suffix
const generateSuffix = () => {
  return Math.random().toString(36).substring(2, 6);
};

// Add a function to build the filename
function buildFilename({ genus, specific_epithet, infraspecies_rank, variety, cultivar }) {
  // Remove punctuation from each field
  const clean = (str) => str ? str.replace(/[^a-zA-Z0-9-]/g, '') : '';
  return [genus, specific_epithet, infraspecies_rank, variety, cultivar]
    .map(clean)
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-') // avoid double hyphens
    .toLowerCase();
}

const PlantImageManager = ({ plantId, plantName, genus, specific_epithet, infraspecies_rank, variety, cultivar, supabase, onImagesChange }) => {
  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Load existing images
  const loadExistingImages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plant_images')
        .select('*')
        .eq('plant_id', plantId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setExistingImages(data || []);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plantId) {
      loadExistingImages();
    }
  }, [plantId]);

  // File status management
  const updateFileStatus = (fileId, status, progress = 0, error = null) => {
    setNewFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status, progress, error }
        : file
    ));
  };

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (files) => {
    const imageFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/') || 
                     file.name.toLowerCase().endsWith('.heic') ||
                     file.name.toLowerCase().endsWith('.heif');
      return isImage;
    });

    const fileObjects = imageFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      error: null,
      preview: URL.createObjectURL(file)
    }));

    setNewFiles(prev => [...prev, ...fileObjects]);
  };

  const removeNewFile = (fileId) => {
    setNewFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  // Upload single file
  const uploadFile = async (fileObj) => {
    try {
      updateFileStatus(fileObj.id, 'processing', 10);

      const webpBlob = await convertToWebP(fileObj.file);
      updateFileStatus(fileObj.id, 'processing', 40);

      const baseName = buildFilename({ genus, specific_epithet, infraspecies_rank, variety, cultivar });
      const suffix = generateSuffix();
      const fileName = `${baseName}-${suffix}.webp`;
      const storagePath = `${plantId}/${fileName}`;

      updateFileStatus(fileObj.id, 'uploading', 50);

      const { error: uploadError } = await supabase.storage
        .from('plant-images')
        .upload(storagePath, webpBlob, {
          contentType: 'image/webp',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;
      updateFileStatus(fileObj.id, 'uploading', 80);

      // Set as primary if this is the first image
      const isPrimary = existingImages.length === 0;

      const { error: dbError } = await supabase
        .from('plant_images')
        .insert({
          plant_id: plantId,
          filename: fileName,
          file_size: webpBlob.size,
          content_type: 'image/webp',
          is_primary: isPrimary,
          path: storagePath
        });

      if (dbError) throw dbError;
      updateFileStatus(fileObj.id, 'completed', 100);

      return { success: true, fileName };
    } catch (error) {
      updateFileStatus(fileObj.id, 'error', 0, error.message);
      return { success: false, error: error.message };
    }
  };

  // Upload all pending files
  const uploadAllFiles = async () => {
    setUploading(true);
    const pendingFiles = newFiles.filter(file => file.status === 'pending');
    for (let i = 0; i < pendingFiles.length; i++) {
      await uploadFile(pendingFiles[i]);
      await loadExistingImages(); // Ensure existingImages is up to date for next upload
    }
    setUploading(false);
    await loadExistingImages(); // Refresh existing images
    // Remove completed files from new files
    setNewFiles(prev => prev.filter(f => f.status !== 'completed'));
    if (onImagesChange) {
      onImagesChange();
    }
  };

  // Set image as primary
  const setPrimaryImage = async (imageId) => {
    try {
      // First, unset all primary flags
      await supabase
        .from('plant_images')
        .update({ is_primary: false })
        .eq('plant_id', plantId);

      // Then set the selected image as primary
      const { error } = await supabase
        .from('plant_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;
      await loadExistingImages();
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };

  // Delete existing image
  const deleteExistingImage = async (imageId, imagePath) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('plant-images')
        .remove([imagePath]);

      // Delete from database
      const { error } = await supabase
        .from('plant_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      await loadExistingImages();
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} stroke="currentColor" fill="none" />
            <path d="M12 8v4m0 4h.01" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'processing':
      case 'uploading':
        return <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />;
      default:
        return <ImageIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Existing Images */}
      {existingImages.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Current Images</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {existingImages.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-images/${image.path}`}
                    alt="Plant"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Primary indicator */}
                {image.is_primary && (
                  <div className="absolute top-2 left-2">
                    <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Primary
                    </div>
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {!image.is_primary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPrimaryImage(image.id)}
                      className="h-8 w-8 p-0"
                      title="Set as primary"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteExistingImage(image.id, image.path)}
                    className="h-8 w-8 p-0"
                    title="Delete image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                onChange={handleFileInput}
                className="hidden"
              />
              
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900 mb-1">
                Upload New Images
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Drag and drop HEIC files or click to select
              </p>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
              >
                Choose Files
              </Button>
              
              {dragActive && (
                <div className="absolute inset-0 bg-green-50 bg-opacity-90 rounded-lg flex items-center justify-center">
                  <div className="text-green-600 font-medium">
                    Drop files here to upload
                  </div>
                </div>
              )}
            </div>

            {/* New Files Preview */}
            {newFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">
                    New Files ({newFiles.length})
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={uploadAllFiles}
                      disabled={uploading || !newFiles.some(f => f.status === 'pending')}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      {uploading ? 'Uploading...' : 'Upload All'}
                    </Button>
                    <Button
                      onClick={() => {
                        newFiles.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
                        setNewFiles([]);
                      }}
                      variant="outline"
                      disabled={uploading}
                      size="sm"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newFiles.map((fileObj) => (
                    <div
                      key={fileObj.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      {/* Preview */}
                      <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                        <img
                          src={fileObj.preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(fileObj.status)}
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {fileObj.name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(fileObj.size)}
                        </p>
                        
                        {(fileObj.status === 'processing' || fileObj.status === 'uploading') && (
                          <div className="mt-1">
                            <Progress value={fileObj.progress} className="h-1" />
                          </div>
                        )}
                        
                        {fileObj.error && (
                          <p className="text-xs text-red-500 mt-1">
                            {fileObj.error}
                          </p>
                        )}
                      </div>
                      
                      {!uploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNewFile(fileObj.id)}
                          className="p-1 h-8 w-8 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlantImageManager; 