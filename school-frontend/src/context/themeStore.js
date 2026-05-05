import { create } from 'zustand';
import { getSchoolConfig } from '../config/schoolConfig.js';

/**
 * Theme Store
 * Manages application theme and school branding
 */

const schoolConfig = getSchoolConfig();

export const useThemeStore = create((set) => ({
  theme: {
    primaryColor: schoolConfig.theme.primaryColor,
    secondaryColor: schoolConfig.theme.secondaryColor,
    accentColor: schoolConfig.theme.accentColor,
    fontFamily: schoolConfig.theme.fontFamily,
  },

  schoolConfig: schoolConfig,

  setTheme: (colors) =>
    set((state) => ({
      theme: { ...state.theme, ...colors },
    })),

  setSchoolConfig: (config) =>
    set((state) => {
      const next = typeof config === 'function' ? config(state.schoolConfig) : config;
      return {
        schoolConfig: {
          ...(state.schoolConfig || {}),
          ...(next || {}),
          contact: {
            ...(state.schoolConfig?.contact || {}),
            ...(next?.contact || {}),
          },
          socialLinks: {
            ...(state.schoolConfig?.socialLinks || {}),
            ...(next?.socialLinks || {}),
          },
        },
      };
    }),
}));

export default useThemeStore;
