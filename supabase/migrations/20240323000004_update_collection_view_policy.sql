-- Drop existing view policies
DROP POLICY IF EXISTS "Users can view their own collections and admin collections" ON collections;
DROP POLICY IF EXISTS "Users can view published collections and their own collections" ON collections;

-- Create new view policy that considers published status
CREATE POLICY "Users can view published collections and their own collections"
ON collections FOR SELECT
USING (
  is_published = true 
  OR auth.uid() = user_id
  OR (is_admin_collection = true AND is_published = true)
); 