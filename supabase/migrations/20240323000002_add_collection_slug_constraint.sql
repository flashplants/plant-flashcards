-- Drop existing constraint if it exists
ALTER TABLE collections
DROP CONSTRAINT IF EXISTS collections_slug_key;

-- Add unique constraint on slug column
ALTER TABLE collections
ADD CONSTRAINT collections_slug_key UNIQUE (slug);

-- Update existing slugs to ensure uniqueness
WITH numbered_slugs AS (
  SELECT 
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) as row_num
  FROM collections
  WHERE slug IS NOT NULL
)
UPDATE collections c
SET slug = CASE 
  WHEN ns.row_num > 1 THEN ns.slug || '-' || (ns.row_num - 1)
  ELSE ns.slug
END
FROM numbered_slugs ns
WHERE c.id = ns.id; 