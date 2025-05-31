-- Create a view that includes collection counts
CREATE OR REPLACE VIEW collections_with_count AS
SELECT 
    c.*,
    COUNT(cp.plant_id) as plant_count
FROM collections c
LEFT JOIN collection_plants cp ON c.id = cp.collection_id
GROUP BY c.id;

-- Add RLS policy for the view
ALTER VIEW collections_with_count OWNER TO authenticated;

-- Grant access to the view
GRANT SELECT ON collections_with_count TO authenticated; 