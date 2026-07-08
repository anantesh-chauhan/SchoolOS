# UI Modernization TODO (Premium Enterprise Look)

## Plan (approved)
- Start with **Component 1: `frontend/src/layouts/DashboardLayout.jsx`**
- Refactor only layout/presentation
- Create presentational UI primitives for consistent styling

## Steps
1. Inspect `frontend/src/layouts/DashboardLayout.jsx` (already partially inspected) and identify exact layout/styling improvements.
2. Add new presentational UI components:
   - `frontend/src/components/ui/PageHeader.jsx`
   - `frontend/src/components/ui/SectionHeader.jsx`
   - `frontend/src/components/ui/SearchInput.jsx`
   - `frontend/src/components/ui/NotificationButton.jsx`
3. Refactor `frontend/src/layouts/DashboardLayout.jsx` to use the new primitives and improve spacing/typography/focus states.
4. Ensure no business logic/APIs/routes/auth are changed.
5. Run a frontend build/lint check.

