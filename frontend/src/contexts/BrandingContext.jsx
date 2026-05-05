import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { useQuery } from "@tanstack/react-query";

import { authService } from "../services/authService";
import { schoolSettingsService } from "../services/schoolSettingsService";

const DEFAULT_BRANDING = {
  primaryColor: "#0f766e",
  secondaryColor: "#0f172a",
  schoolName: "SchoolOS",
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

    staleTime: 1000 * 60 * 10, // 10 minutes

    retry: 1,

  });

  const branding =
    brandingQuery.data?.data ||
    DEFAULT_BRANDING;

  // Apply CSS variables

  useEffect(() => {

    if (!branding) return;

    const root =
      document.documentElement;

    root.style.setProperty(
      "--school-primary",
      branding.primaryColor ||
        DEFAULT_BRANDING.primaryColor
    );

    root.style.setProperty(
      "--school-secondary",
      branding.secondaryColor ||
        DEFAULT_BRANDING.secondaryColor
    );

  }, [branding]);

  const value = useMemo(
    () => ({
      branding,
      isLoading:
        brandingQuery.isLoading,
      isError:
        brandingQuery.isError,
      refetch:
        brandingQuery.refetch,
    }),
    [
      branding,
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