# Render deployment

SchoolOS deploys as one Render web service. The build compiles the sibling
`frontend` project, copies the generated files into `backend/public`, and the
Express server serves both the application and `/api`.

## Render dashboard settings

- Root Directory: leave empty
- Runtime: `Node`
- Build Command: `cd backend && npm ci && npm run build`
- Start Command: `cd backend && npx prisma migrate deploy && npm start`
- Health Check Path: `/health`
- `NODE_VERSION`: `20`
- `VITE_API_BASE_URL`: `/api`

Leaving Root Directory empty is required. Render excludes sibling directories
when Root Directory is set to `backend`, so the backend build would not be able
to access `frontend`.

Set `DATABASE_URL` and other production secrets in the Render dashboard. The
equivalent single-service Blueprint is in `backend/render.yaml`.
