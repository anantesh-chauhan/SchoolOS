import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { useQuery } from "@tanstack/react-query";

import { authService } from "../services/authService";
import { schoolSettingsService } from "../services/schoolSettingsService";
import {
  applySchoolPalette,
  DEFAULT_SCHOOL_PALETTE,
  findSchoolPalette,
  SCHOOL_PALETTES,
} from "../theme/schoolPalettes";

const DEFAULT_BRANDING = {
  primaryColor: DEFAULT_SCHOOL_PALETTE.primary,
  secondaryColor: DEFAULT_SCHOOL_PALETTE.secondary,
  schoolName: "SchoolOS an Analytic Platform of your School",
};

const BrandingContext = createContext({
  branding: DEFAULT_BRANDING,
  isLoading: false,
});

export function BrandingProvider({ children }) {

  const user = authService.getCurrentUser();

  const brandingQuery = useQuery({

    queryKey: [
      "current-branding",
      user?.schoolId,
    ],

    queryFn: () =>
      schoolSettingsService.getCurrentBranding(),

    enabled: Boolean(user?.schoolId),

    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,

    retry: 1,

  });

  const branding =
    brandingQuery.data?.data ||
    DEFAULT_BRANDING;

  const palette = useMemo(
    () => findSchoolPalette(branding.primaryColor, branding.secondaryColor),
    [branding.primaryColor, branding.secondaryColor]
  );

  useEffect(() => {

    if (!branding) return;

    const root =
      document.documentElement;

    applySchoolPalette(palette);

    document.title = branding.schoolName || DEFAULT_BRANDING.schoolName;
    if (branding.logoUrl) {
      let favicon = document.querySelector("link[rel='icon']");
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = branding.logoUrl;
    }

  }, [branding, palette]);

  const value = useMemo(
    () => ({
      branding,
      palette,
      palettes: SCHOOL_PALETTES,
      isLoading:
        brandingQuery.isLoading,
      isError:
        brandingQuery.isError,
      refetch:
        brandingQuery.refetch,
    }),
    [
      branding,
      palette,
      brandingQuery.isLoading,
      brandingQuery.isError,
      brandingQuery.refetch,
    ]
  );

  return (
    <BrandingContext.Provider
      value={value}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {

  const context =
    useContext(BrandingContext);

  if (!context) {
    throw new Error(
      "useBranding must be used inside BrandingProvider"
    );
  }

  return context;
}
