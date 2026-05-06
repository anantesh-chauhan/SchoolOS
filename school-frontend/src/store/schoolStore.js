import { create } from 'zustand';

const initialSchoolState = {
  schoolId: null,
  schoolSlug: null,
  name: '',
  slug: '',
  theme: {
    primaryColor: '#3498db',
    secondaryColor: '#0f172a',
    accentColor: '#f59e0b',
    fontFamily: 'Manrope',
  },
  config: {
    pages: [],
    sections: [],
  },
  status: 'idle',
  error: null,
};

export const useSchoolStore = create((set) => ({
  ...initialSchoolState,
  setSchool: (school) =>
    set((state) => ({
      ...state,
      schoolId: school?.schoolId ?? school?.id ?? state.schoolId,
      schoolSlug: school?.schoolSlug ?? school?.slug ?? state.schoolSlug,
      name: school?.name ?? school?.schoolName ?? state.name,
      slug: school?.slug ?? state.slug,
      theme: {
        ...state.theme,
        ...(school?.theme || {}),
      },
      config: {
        ...state.config,
        ...(school?.config || {}),
      },
      status: school?.status || 'ready',
      error: null,
    })),
  setSchoolSlug: (schoolSlug) => set({ schoolSlug, slug: schoolSlug }),
  setTheme: (theme) =>
    set((state) => ({
      theme: {
        ...state.theme,
        ...(theme || {}),
      },
    })),
  setConfig: (config) =>
    set((state) => ({
      config: {
        ...state.config,
        ...(config || {}),
      },
    })),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),
  clearSchool: () => set(initialSchoolState),
}));

export default useSchoolStore;
