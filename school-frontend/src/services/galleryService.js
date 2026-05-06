import apiClient from '../utils/apiClient.js';

/**
 * Gallery Service for school-frontend
 * Public gallery APIs (multitenant - schoolId required)
 */

export const galleryService = {
  /**
   * List public gallery groups for a school
   */
  listPublicGroups: async (schoolId) => {
    const response = await apiClient.get('/gallery/public/groups', { 
      params: { schoolId } 
    });
    return response.data;
  },

  /**
   * List public gallery photos for a group
   */
  listPublicPhotos: async (groupId, schoolId) => {
    const response = await apiClient.get(`/gallery/public/groups/${groupId}/photos`, { 
      params: { schoolId } 
    });
    return response.data;
  }
};

export default galleryService;

