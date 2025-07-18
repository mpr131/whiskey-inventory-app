interface ExtractedAbvData {
  abv: number | null;
  proof: number | null;
  statedProof: string | null;
}

export function extractAbvFromName(name: string): ExtractedAbvData {
  // Initialize result
  const result: ExtractedAbvData = {
    abv: null,
    proof: null,
    statedProof: null
  };

  // Common patterns for ABV/proof in whiskey names
  const patterns = [
    // Match patterns like "57.55%" or "46.3%" (ABV percentage)
    /(\d+(?:\.\d+)?)\s*%/,
    
    // Match patterns like "115 proof" or "92.6 proof"
    /(\d+(?:\.\d+)?)\s*proof/i,
    
    // Match patterns like "50.5% ABV"
    /(\d+(?:\.\d+)?)\s*%\s*ABV/i,
    
    // Match patterns like "ABV 46%" or "ABV: 50%"
    /ABV\s*:?\s*(\d+(?:\.\d+)?)\s*%/i,
    
    // Match patterns like "100° proof" or "100°"
    /(\d+(?:\.\d+)?)\s*°/,
    
    // Match patterns in parentheses like "(50%)" or "(100 proof)"
    /\((\d+(?:\.\d+)?)\s*%\)/,
    /\((\d+(?:\.\d+)?)\s*proof\)/i,
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      
      // Store the original stated proof string
      if (!result.statedProof) {
        result.statedProof = match[0].trim();
      }
      
      // Determine if it's ABV or proof based on context
      if (pattern.source.includes('proof') || value > 100) {
        // It's proof
        result.proof = value;
        result.abv = value / 2; // Convert proof to ABV
      } else {
        // It's ABV
        result.abv = value;
        result.proof = value * 2; // Convert ABV to proof
      }
      
      // If we found a match, we're done
      break;
    }
  }

  // Validate results
  if (result.abv !== null) {
    // Ensure ABV is reasonable (between 20% and 75% for whiskey)
    if (result.abv < 20 || result.abv > 75) {
      // This might be a misidentification, reset
      result.abv = null;
      result.proof = null;
      result.statedProof = null;
    }
  }

  return result;
}

// Helper function to clean bottle name by removing ABV/proof information
export function cleanBottleName(name: string): string {
  // Remove all ABV/proof patterns
  let cleanedName = name;
  
  const patternsToRemove = [
    /\s*\d+(?:\.\d+)?\s*%\s*ABV/gi,
    /\s*ABV\s*:?\s*\d+(?:\.\d+)?\s*%/gi,
    /\s*\d+(?:\.\d+)?\s*%/g,
    /\s*\d+(?:\.\d+)?\s*proof/gi,
    /\s*\d+(?:\.\d+)?\s*°/g,
    /\s*\(\d+(?:\.\d+)?\s*%\)/g,
    /\s*\(\d+(?:\.\d+)?\s*proof\)/gi,
  ];
  
  for (const pattern of patternsToRemove) {
    cleanedName = cleanedName.replace(pattern, '');
  }
  
  // Clean up any double spaces or trailing/leading spaces
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();
  
  return cleanedName;
}