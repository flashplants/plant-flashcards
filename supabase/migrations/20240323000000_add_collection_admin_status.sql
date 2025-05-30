-- Add is_admin_collection column to collections table
ALTER TABLE collections
ADD COLUMN is_admin_collection BOOLEAN DEFAULT false;

-- Update existing collections to be admin collections if they were created by an admin user
UPDATE collections
SET is_admin_collection = true
WHERE user_id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true');

-- Update user_id for specific collections
UPDATE collections
SET user_id = '7c8e8fe3-f933-4a01-a299-f8c4780863c0'
WHERE id IN (3, 5, 6);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own collections and admin collections" ON collections;
DROP POLICY IF EXISTS "Users can create their own collections" ON collections;
DROP POLICY IF EXISTS "Users can update their own collections" ON collections;
DROP POLICY IF EXISTS "Users can delete their own collections" ON collections;

-- Add RLS policies for collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Policy for viewing collections
CREATE POLICY "Users can view their own collections and admin collections"
ON collections FOR SELECT
USING (
  auth.uid() = user_id OR is_admin_collection = true
);

-- Policy for inserting collections
CREATE POLICY "Users can create their own collections"
ON collections FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Policy for updating collections
CREATE POLICY "Users can update their own collections"
ON collections FOR UPDATE
USING (
  auth.uid() = user_id
);

-- Policy for deleting collections
CREATE POLICY "Users can delete their own collections"
ON collections FOR DELETE
USING (
  auth.uid() = user_id
); 