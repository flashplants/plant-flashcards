# Plants Table Schema

## Required Fields
- `id` (integer, primary key)
- `scientific_name` (text)
- `common_name` (text)
- `family` (text)
- `genus` (text)
- `hybrid_marker_position` (text, default: 'none')

## Optional Fields
- `species` (text)
- `specific_epithet` (text)
- `subspecies` (text)
- `variety` (text)
- `cultivar` (text)
- `description` (text)
- `is_published` (boolean, default: false)
- `created_at` (timestamp with time zone, default: now())
- `updated_at` (timestamp with time zone, default: now())
- `hybrid_marker` (text)
- `infraspecies_rank` (text)
- `infraspecies_epithet` (text)
- `native_to` (text)
- `bloom_period` (text)
- `image_url` (text)
- `external_resources` (jsonb)
- `owner_id` (uuid)
- `slug` (text)
- `default_collection_id` (integer)

## Notes
- Timestamps are automatically managed
- Hybrid marker position can be: 'none', 'genus', 'species', 'infraspecies'
- External resources are stored as JSONB for flexible metadata 