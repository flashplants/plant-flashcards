import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle, Image as ImageIcon, File } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Simple Progress component since it's not in your shadcn setup
const Progress = ({ value, className }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-green-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

// Helper function to convert image to WebP (keeping your existing logic)
const convertToWebP = async (file) => {
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    // Use heic2any to convert directly to WebP
    try {
      const heic2any = (await import('heic2any')).default;
      const webpBlob = await heic2any({ blob: file, toType: 'image/webp', quality: 0.8 });
      return webpBlob;
    } catch (err) {
      throw new Error('Failed to convert HEIC/HEIF to WebP: ' + err.message);
    }
  }
  // Existing logic for other types
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
        URL.revokeObjectURL(img.src); // Clean up memory
        resolve(blob);
      }, 'image/webp', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
  });
};

// Helper function to generate a short random suffix (keeping your existing logic)
const generateSuffix = () => {
  return Math.random().toString(36).substring(2, 6);
};

// Add a function to build the filename
function buildFilename({ genus, specific_epithet, infraspecies_rank, variety, cultivar }) {
  return [genus, specific_epithet, infraspecies_rank, variety, cultivar]
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-') // avoid double hyphens
    .toLowerCase();
}

const BulkImageUpload = ({ plantId, plantName, onUploadComplete, supabase }) => {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [existingImagesCount, setExistingImagesCount] = useState(0);

  // Load existing images count
  const loadExistingImagesCount = async () => {
    const { data, error } = await supabase
      .from('plant_images')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', plantId);
    if (!error && typeof data?.length === 'number') {
      setExistingImagesCount(data.length);
    }
  };

  useEffect(() => {
    if (plantId) {
      loadExistingImagesCount();
    }
  }, [plantId]);

  // File status: 'pending', 'processing', 'uploading', 'completed', 'error'
  const updateFileStatus = (fileId, status, progress = 0, error = null) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status, progress, error }
        : file
    ));
  };

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

  const addFiles = (newFiles) => {
    const imageFiles = newFiles.filter(file => {
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
      error: null
    }));

    setFiles(prev => [...prev, ...fileObjects]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // Modified uploadFile to accept isPrimary argument
  const uploadFile = async (fileObj, isPrimary = false) => {
    try {
      updateFileStatus(fileObj.id, 'processing', 10);
      let webpBlob;
      try {
        webpBlob = await convertToWebP(fileObj.file);
        updateFileStatus(fileObj.id, 'processing', 40);
      } catch (err) {
        console.error(`[Bulk Image Upload] Conversion failed for ${fileObj.name} (${fileObj.size} bytes, ${fileObj.file.type}):`, err.message, err.stack);
        updateFileStatus(fileObj.id, 'error', 0, `Conversion failed: ${err.message}`);
        return { success: false, error: `Conversion failed: ${err.message}` };
      }

      const baseName = buildFilename({ genus, specific_epithet, infraspecies_rank, variety, cultivar });
      const suffix = generateSuffix();
      const fileName = `${baseName}-${suffix}.webp`;
      const storagePath = `${plantId}/${fileName}`;

      updateFileStatus(fileObj.id, 'uploading', 50);
      try {
        const { error: uploadError } = await supabase.storage
          .from('plant-images')
          .upload(storagePath, webpBlob, {
            contentType: 'image/webp',
            cacheControl: '3600'
          });
        if (uploadError) throw uploadError;
        updateFileStatus(fileObj.id, 'uploading', 80);
      } catch (err) {
        console.error(`[Bulk Image Upload] Storage upload failed for ${fileObj.name} (${fileObj.size} bytes, ${fileObj.file.type}):`, err.message, err.stack);
        updateFileStatus(fileObj.id, 'error', 0, `Storage upload failed: ${err.message}`);
        return { success: false, error: `Storage upload failed: ${err.message}` };
      }

      try {
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
      } catch (err) {
        console.error(`[Bulk Image Upload] DB insert failed for ${fileObj.name} (${fileObj.size} bytes, ${fileObj.file.type}):`, err.message, err.stack);
        updateFileStatus(fileObj.id, 'error', 0, `DB insert failed: ${err.message}`);
        return { success: false, error: `DB insert failed: ${err.message}` };
      }
    } catch (error) {
      console.error(`[Bulk Image Upload] Unexpected error for ${fileObj.name} (${fileObj.size} bytes, ${fileObj.file.type}):`, error.message, error.stack);
      updateFileStatus(fileObj.id, 'error', 0, `Unexpected error: ${error.message}`);
      return { success: false, error: `Unexpected error: ${error.message}` };
    }
  };

  const uploadAllFiles = async () => {
    setUploading(true);
    
    const pendingFiles = files.filter(file => file.status === 'pending');
    
    // Determine which file (if any) should be primary
    let primarySet = false;
    for (let i = 0; i < pendingFiles.length; i++) {
      // Only set as primary if this is the first image and there are no existing images
      const isPrimary = !primarySet && existingImagesCount === 0 && i === 0;
      await uploadFile(pendingFiles[i], isPrimary);
      if (isPrimary) primarySet = true;
    }

    setUploading(false);
    
    // Check if all uploads completed successfully
    const completedCount = files.filter(f => f.status === 'completed').length;
    if (onUploadComplete) {
      onUploadComplete(completedCount);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} stroke="currentColor" fill="none" />
            <path d="M12 8v4m0 4h.01" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'processing':
      case 'uploading':
        return <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />;
      default:
        return <ImageIcon className="w-5 h-5 text-gray-400" />;
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
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
            
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Images
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop HEIC files from Apple Photos or click to select
            </p>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
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

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  Files ({files.length})
                </h4>
                <div className="flex gap-2">
                  <Button
                    onClick={uploadAllFiles}
                    disabled={uploading || files.every(f => f.status !== 'pending')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {uploading ? 'Uploading...' : 'Upload All'}
                  </Button>
                  <Button
                    onClick={() => setFiles([])}
                    variant="outline"
                    disabled={uploading}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {files.map((fileObj) => (
                  <div
                    key={fileObj.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(fileObj.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {fileObj.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(fileObj.size)}
                        </p>
                      </div>
                      
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
                      
                      {fileObj.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-1">
                          Uploaded successfully
                        </p>
                      )}
                    </div>
                    
                    {!uploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileObj.id)}
                        className="flex-shrink-0 p-1 h-8 w-8"
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
  );
};

export default BulkImageUpload; 