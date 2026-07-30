# SchoolOS Progressive Web App

The main `frontend` package is installable as a Progressive Web App. Its global
identity remains SchoolOS; authenticated tenant branding is still applied only
inside the application.

## Installation

Build and serve the production application over HTTPS. Chromium browsers show
the in-app **Install SchoolOS** action when installation is supported. On iPhone
and iPad Safari, use **Share → Add to Home Screen**. The install suggestion can
be dismissed and remains hidden for 14 days.

The manifest uses `orientation: "any"`. SchoolOS does not call the Screen
Orientation lock API, so rotation remains controlled by the device. Responsive
CSS reflows the interface when the viewport changes between portrait and
landscape.

## Build and update behavior

```bash
cd frontend
npm install
npm run build
```

`vite-plugin-pwa` generates `manifest.webmanifest`, `sw.js`, and Workbox assets
during the production build. Development mode does not register a service
worker. New deployments show a prompt with **Update now** and **Later**; SchoolOS
never silently reloads an open data-entry screen. An update check runs hourly.

To test an update:

1. Build and serve the app over HTTPS (localhost is also accepted by browsers).
2. Install or open the app once, then close and reopen it.
3. Change a frontend asset and produce/deploy a second build.
4. Reopen or focus the original app and, if needed, use the browser Application
   panel to run the service-worker update check.
5. Confirm that SchoolOS prompts before activating and reloading the new version.

During development, remove an old worker and caches from the browser Application
panel, or use **Clear site data**. Static PWA assets are not deleted on logout.

## Offline and cache safety

Only the generated application shell, hashed JavaScript/CSS, local icons, and
local versioned fonts are cached. React Router navigation falls back to the
cached application shell. A network banner and `/offline` help page explain the
limitations.

Every write request is rejected centrally while `navigator.onLine` is false.
Sensitive work is never queued: attendance, fees, payments, receipts, payroll,
marks, homework, uploads, admissions, profiles, passwords, polls, notices, and
notifications all require a live connection.

No `/api` endpoint is runtime-cached. This deliberately includes authentication,
public routes, school branding, all tenant data, reports, and downloads. The
Express server marks all API responses `private, no-store`. Cloudinary delivery
and upload URLs are also excluded because the same account contains a mixture of
public and private school media; broad caching could leak tenant content on a
shared device.

Logout clears access/refresh tokens, user identity, the instant-login session
list, and the in-memory React Query cache. It does not clear harmless versioned
application assets.
