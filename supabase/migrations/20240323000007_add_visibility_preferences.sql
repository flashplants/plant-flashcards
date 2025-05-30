-- Add visibility preference columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS show_admin_plants BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_admin_collections BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_admin_sightings BOOLEAN DEFAULT true;

-- Add comment to explain the columns
COMMENT ON COLUMN profiles.show_admin_plants IS 'Whether to show plants created by administrators';
COMMENT ON COLUMN profiles.show_admin_collections IS 'Whether to show collections created by administrators';
COMMENT ON COLUMN profiles.show_admin_sightings IS 'Whether to show plant sightings from administrators'; 