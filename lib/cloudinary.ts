import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

// Helper to generate optimized URL
export function getOptimizedUrl(publicId: string, width?: number) {
  const transformations: any = {
    quality: 'auto',
    fetch_format: 'auto',
  };
  
  if (width) {
    transformations.width = width;
    transformations.crop = 'fill';
  }
  
  return cloudinary.url(publicId, transformations);
}

// Helper to extract public ID from Cloudinary URL
export function getPublicIdFromUrl(url: string): string {
  // Extract public ID from Cloudinary URL
  const match = url.match(/\/v\d+\/(.+)\.\w+$/);
  return match ? match[1] : '';
}