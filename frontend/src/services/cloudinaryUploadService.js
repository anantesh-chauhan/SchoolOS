import apiClient from './api';

const toFormData = (file, signatureData) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', String(signatureData.timestamp));
  formData.append('folder', signatureData.folder);
  formData.append('signature', signatureData.signature);

  if (signatureData.publicId) {
    formData.append('public_id', signatureData.publicId);
  }

  if (signatureData.overwrite) {
    formData.append('overwrite', 'true');
  }

  if (signatureData.invalidate) {
    formData.append('invalidate', 'true');
  }

  return formData;
};

const uploadToCloudinary = async (file, signatureData) => {
  const cloudName = signatureData.cloudName;
  const resourceType = file.type?.startsWith('video/')
    ? 'video'
    : file.type?.startsWith('image/')
      ? 'image'
      : 'raw';
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const formData = toFormData(file, signatureData);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || 'Cloudinary upload failed');
  }

  return response.json();
};

export const cloudinaryUploadService = {
  getGallerySignature: async ({ schoolId, groupId }) => {
    const response = await apiClient.post('/uploads/gallery-signature', { schoolId, groupId });
    return response.data;
  },
  getSchoolLogoSignature: async ({ schoolId }) => {
    const response = await apiClient.post('/uploads/school-logo-signature', { schoolId });
    return response.data;
  },
  getSectionResourceSignature: async ({ schoolId, classId, sectionId, subjectId }) => {
    const response = await apiClient.post('/uploads/section-resource-signature', { schoolId, classId, sectionId, subjectId });
    return response.data;
  },
  getIssueScreenshotSignature: async () => (await apiClient.post('/uploads/issue-screenshot-signature')).data,
  uploadToCloudinary,
};
