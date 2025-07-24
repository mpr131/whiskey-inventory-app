import { IMasterBottle } from '@/models/MasterBottle';

interface UserBottleWithPhotos {
  photos?: Array<{
    url: string;
    uploadedAt?: Date;
  }>;
}

/**
 * Get the best available image for a bottle based on priority hierarchy:
 * 1. User's own photos (highest priority)
 * 2. Community photos on MasterBottle  
 * 3. Default external image (fallback)
 * 4. Placeholder image
 */
export function getBottleImage(
  userBottle?: UserBottleWithPhotos | null,
  masterBottle?: IMasterBottle | null
): { url: string; source: 'user' | 'community' | 'external' | 'placeholder' } {
  // Priority 1: User's own photos
  if (userBottle?.photos && userBottle.photos.length > 0) {
    return {
      url: userBottle.photos[0].url,
      source: 'user'
    };
  }
  
  // Priority 2: Community photos on MasterBottle
  if (masterBottle?.communityPhotos && masterBottle.communityPhotos.length > 0) {
    return {
      url: masterBottle.communityPhotos[0].url,
      source: 'community'
    };
  }
  
  // Priority 3: Default from external import
  if (masterBottle?.defaultImageUrl) {
    return {
      url: masterBottle.defaultImageUrl,
      source: 'external'
    };
  }
  
  // Priority 4: No image placeholder
  return {
    url: '/images/bottle-placeholder.png',
    source: 'placeholder'
  };
}

/**
 * Get all available images for a bottle, sorted by priority
 */
export function getAllBottleImages(
  userBottle?: UserBottleWithPhotos | null,
  masterBottle?: IMasterBottle | null
): Array<{ url: string; source: string }> {
  const images: Array<{ url: string; source: string }> = [];
  
  // Add user photos
  if (userBottle?.photos) {
    userBottle.photos.forEach(photo => {
      images.push({ url: photo.url, source: 'Your photo' });
    });
  }
  
  // Add community photos
  if (masterBottle?.communityPhotos) {
    masterBottle.communityPhotos.forEach(photo => {
      images.push({ url: photo.url, source: 'Community photo' });
    });
  }
  
  // Add external images
  if (masterBottle?.imageUrls) {
    masterBottle.imageUrls.forEach(url => {
      images.push({ url, source: 'Stock photo' });
    });
  }
  
  return images;
}