-- Update all existing plants to be admin plants
UPDATE plants
SET is_admin_plant = true
WHERE is_admin_plant = false;

-- Update user_id for admin plants to be the first admin user
UPDATE plants
SET user_id = (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true' LIMIT 1)
WHERE is_admin_plant = true AND user_id IS NULL; 