-- Add user_id and is_admin_plant columns to plants table
ALTER TABLE plants
ADD COLUMN user_id UUID REFERENCES auth.users(id),
ADD COLUMN is_admin_plant BOOLEAN DEFAULT false;

-- Update existing plants to be admin plants and set their user_id to the first admin user
UPDATE plants
SET is_admin_plant = true,
    user_id = (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true' LIMIT 1)
WHERE is_admin_plant IS NULL;

-- Add RLS policies for plants
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

-- Policy for viewing plants
CREATE POLICY "Users can view their own plants and admin plants"
ON plants FOR SELECT
USING (
  auth.uid() = user_id OR is_admin_plant = true
);

-- Policy for inserting plants
CREATE POLICY "Users can create their own plants"
ON plants FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Policy for updating plants
CREATE POLICY "Users can update their own plants"
ON plants FOR UPDATE
USING (
  auth.uid() = user_id
);

-- Policy for deleting plants
CREATE POLICY "Users can delete their own plants"
ON plants FOR DELETE
USING (
  auth.uid() = user_id
); 