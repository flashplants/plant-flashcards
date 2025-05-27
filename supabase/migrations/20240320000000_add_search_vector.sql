-- Add search vector column
ALTER TABLE plants ADD COLUMN search_vector tsvector;

-- Create a function to update the search vector
CREATE OR REPLACE FUNCTION plants_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.scientific_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.common_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.genus, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.specific_epithet, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.infraspecies_rank, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.infraspecies_epithet, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.variety, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.cultivar, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.family, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the search vector
CREATE TRIGGER plants_search_vector_update
  BEFORE INSERT OR UPDATE ON plants
  FOR EACH ROW
  EXECUTE FUNCTION plants_search_vector_update();

-- Create a GIN index for faster searching
CREATE INDEX plants_search_vector_idx ON plants USING GIN (search_vector);

-- Update existing rows
UPDATE plants SET search_vector = NULL; 