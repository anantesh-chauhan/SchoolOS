import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export const uploadBufferToCloudinary = ({ buffer, folder, resourceType = 'auto' }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });

export const signCloudinaryParams = (params) => {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    throw new Error('Cloudinary API secret is not configured');
  }

  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${sorted}${apiSecret}`).digest('hex');
};

export const getOptimizedCloudinaryImageUrl = (url, transformations = ['f_auto', 'q_auto']) => {
  if (!url || !url.includes('/upload/')) {
    return url;
  }

  const transformText = transformations.join(',');
  return url.replace('/upload/', `/upload/${transformText}/`);
};

export default {
  uploadBufferToCloudinary,
  isCloudinaryConfigured,
  signCloudinaryParams,
  getOptimizedCloudinaryImageUrl,
};
