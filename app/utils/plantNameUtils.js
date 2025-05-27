export function buildFullPlantName(plant) {
  if (!plant) return '';

  // Build the name parts array
  let nameParts = [];
  
  // Add hybrid marker based on position (never italicized)
  if (plant.hybrid_marker === 'x') {
    if (plant.hybrid_marker_position === 'before_genus') {
      nameParts.push({ text: 'x', italic: false });
    }
  }
  
  // Add genus (italic)
  if (plant.genus) {
    nameParts.push({ text: plant.genus, italic: true });
  }
  
  // Add hybrid marker if it should be between genus and species (never italicized)
  if (plant.hybrid_marker === 'x' && plant.hybrid_marker_position === 'between_genus_species') {
    nameParts.push({ text: 'x', italic: false });
  }
  
  // Add specific epithet (italic)
  if (plant.specific_epithet) {
    nameParts.push({ text: plant.specific_epithet, italic: true });
  }

  // Add infraspecies rank and epithet if they exist
  if (plant.infraspecies_rank) {
    const rank = plant.infraspecies_rank === 'subsp.' ? 'ssp.' : plant.infraspecies_rank;
    nameParts.push({ text: rank, italic: false });
    if (plant.infraspecies_epithet) {
      nameParts.push({ text: plant.infraspecies_epithet, italic: true });
    }
  }

  // Add variety if it exists (rank non-italic, epithet italic)
  if (plant.variety) {
    nameParts.push({ text: 'var.', italic: false });
    nameParts.push({ text: plant.variety, italic: true });
  }

  // Add forma if it exists (rank non-italic, epithet italic)
  if (plant.forma) {
    nameParts.push({ text: 'f.', italic: false });
    nameParts.push({ text: plant.forma, italic: true });
  }

  // Add cultivar with single quotes if it exists
  if (plant.cultivar) {
    nameParts.push({ text: `'${plant.cultivar}'`, italic: false });
  }

  // Build the final string with proper spacing and commas
  let result = [];
  
  // Add the scientific name parts with proper italicization
  let scientificNameParts = nameParts.map(part => {
    if (typeof part === 'string') {
      return part;
    }
    return part.italic ? `<i>${part.text}</i>` : part.text;
  });
  result.push({ text: scientificNameParts.join(' '), italic: false });

  // Add common name if it exists
  if (plant.common_name) {
    result.push(plant.common_name);
  }

  // Add family if it exists
  if (plant.family) {
    result.push({ text: plant.family, italic: true });
  }

  return result;
}

export function renderPlantName(plant) {
  const parts = buildFullPlantName(plant);
  return parts.map((part, index) => (
    <span key={index}>
      {typeof part === 'string' ? (
        <>
          {part}
          {index < parts.length - 1 ? ',' : ''}
        </>
      ) : (
        <>
          <span dangerouslySetInnerHTML={{ __html: part.italic ? `<i>${part.text}</i>` : part.text }} />
          {index < parts.length - 1 ? ',' : ''}
        </>
      )}
      {index < parts.length - 1 ? ' ' : ''}
    </span>
  ));
} 