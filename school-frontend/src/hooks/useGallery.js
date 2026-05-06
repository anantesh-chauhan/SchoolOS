import { useState, useEffect } from 'react';
import { galleryService } from '../services/galleryService.js';

/**
 * Custom hook for gallery data
 * Returns groups and photos with loading states
 */
export const useGallery = (schoolId) => {
  const [groups, setGroups] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await galleryService.listPublicGroups(schoolId);
      setGroups(response.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load gallery groups');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async (groupId) => {
    try {
      const response = await galleryService.listPublicPhotos(groupId, schoolId);
      setPhotos(response.data || []);
    } catch (err) {
      console.error('Failed to load photos:', err);
      setPhotos([]);
    }
  };

  useEffect(() => {
    if (schoolId) {
      loadGroups();
    }
  }, [schoolId]);

  const selectGroup = async (group) => {
    setSelectedGroup(group);
    if (group) {
      await loadPhotos(group.id);
    } else {
      setPhotos([]);
    }
  };

  return {
    groups,
    photos,
    selectedGroup,
    loading,
    error,
    loadGroups,
    selectGroup
  };
};

