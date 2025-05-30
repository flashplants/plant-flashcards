-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload to their folders" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to plant images" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view plant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete plant images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can update plant images" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can upload plant images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage files in their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to manage their own plant images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to manage plant images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view user plant images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admins to manage all plant images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view all plant images" ON storage.objects;

-- Drop unused bucket
DELETE FROM storage.buckets WHERE id = 'admin-plant-images';

-- Admin policies for both buckets
CREATE POLICY "Allow admins to manage all plant images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Regular user policies for user-plant-images bucket
CREATE POLICY "Allow users to manage their own plant images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'user-plant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  bucket_id = 'user-plant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Public read access for both buckets
CREATE POLICY "Allow public to view all plant images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id IN ('plant-images', 'user-plant-images')
); 