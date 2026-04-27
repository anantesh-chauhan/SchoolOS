import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/authService';
import { schoolSettingsService } from '../services/schoolSettingsService';

const BrandingContext = createContext({
  branding: null,
  isLoading: false,
});

export function BrandingProvider({ children }) {
  const user = authService.getCurrentUser();

  const brandingQuery = useQuery({
    queryKey: ['current-branding', user?.schoolId],
    queryFn: () => schoolSettingsService.getCurrentBranding(),
    enabled: Boolean(user?.schoolId),
  });

  const branding = brandingQuery.data?.data || null;

  useEffect(() => {
    if (!branding) {
      return;
    }

    document.documentElement.style.setProperty('--school-primary', branding.primaryColor || '#0f766e');
    document.documentElement.style.setProperty('--school-secondary', branding.secondaryColor || '#0f172a');
  }, [branding]);

  const value = useMemo(
    () => ({
      branding,
      isLoading: brandingQuery.isLoading,
    }),
    [branding, brandingQuery.isLoading]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
