export function mapCategory(b2cType: string): string {
  const categoryMap: Record<string, string> = {
    'Whiskey': 'American Whiskey',
    'Bourbon': 'Bourbon',
    'Scotch': 'Scotch',
    'Irish': 'Irish Whiskey',
    'Japanese': 'Japanese Whiskey',
    'Canadian': 'Canadian Whisky',
    'Rye': 'Rye Whiskey',
    'Tennessee': 'Tennessee Whiskey',
    'Vodka': 'Vodka',
    'Rum': 'Rum',
    'Gin': 'Gin',
    'Tequila': 'Tequila',
    'Mezcal': 'Mezcal',
    'Brandy': 'Brandy',
    'Cognac': 'Cognac',
    'Liqueur': 'Liqueur',
    'Wine': 'Wine',
    'Beer': 'Beer',
  };
  
  return categoryMap[b2cType] || b2cType || 'Spirits';
}

export function extractAge(ageString: string | null | undefined): number | undefined {
  if (!ageString) return undefined;
  
  const match = ageString.match(/(\d+)\s*Year/i);
  return match ? parseInt(match[1]) : undefined;
}

export function cleanHTML(html: string | null | undefined): string {
  if (!html) return '';
  
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseSize(sizeString: string | null | undefined): string {
  if (!sizeString) return '750 ml';
  
  // Normalize common sizes to our format
  const sizeMap: Record<string, string> = {
    '750ML': '750 ml',
    '1L': '1000 ml', 
    '1.75L': '1750 ml',
    '375ML': '375 ml',
    '50ML': '50 ml',
    '200ML': '200 ml',
    '1000ML': '1000 ml',
    '700ML': '700 ml',
    '500ML': '500 ml',
    '1.5L': '1500 ml',
    '3L': '3000 ml',
    '5L': '5000 ml'
  };
  
  const upperSize = sizeString.toUpperCase();
  return sizeMap[upperSize] || sizeString.toLowerCase().replace('ml', ' ml');
}

export interface ExternalProduct {
  repositoryId: string;
  displayName?: string;
  brand?: string;
  b2c_type?: string;
  b2c_newMarketingCategory?: string;
  b2c_age?: string;
  b2c_proof?: string;
  listPrice?: number;
  b2c_size?: string;
  b2c_tastingNotes?: string;
  b2c_region?: string;
  b2c_country?: string;
  b2c_upc?: string;
  primaryLargeImageURL?: string;
  primaryMediumImageURL?: string;
  primarySmallImageURL?: string;
}