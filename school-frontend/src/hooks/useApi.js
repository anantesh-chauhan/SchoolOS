import { useEffect, useState } from 'react';
import apiClient from '../utils/apiClient.js';

/**
 * useApi Hook
 * Fetches data from API endpoints
 */

export const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(url);
        setData(response.data.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching data');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
};

/**
 * useLocationScroll Hook
 * Scroll to top on route change
 */
export const useLocationScroll = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
};
