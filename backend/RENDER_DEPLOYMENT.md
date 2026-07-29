# Render deployment

SchoolOS deploys as one Render web service. The build compiles the sibling
`frontend` project, copies the generated files into `backend/public`, and the
Express server serves both the application and `/api`.

## Render dashboard settings

- Root Directory: leave empty
- Runtime: `Node`
- Build Command: `cd backend && npm ci && npm run build`
- Start Command: `cd backend && npm run start:render`
- Health Check Path: `/health`
- `NODE_VERSION`: `20`
- `VITE_API_BASE_URL`: `/api`

Leaving Root Directory empty is required. Render excludes sibling directories
when Root Directory is set to `backend`, so the backend build would not be able
to access `frontend`.

## Supabase database connection

Render cannot reach Supabase's direct `db.<project-ref>.supabase.co:5432`
hostname unless the Supabase IPv4 add-on is enabled. Do not use the Direct
Connection string as `DATABASE_URL`.

In Supabase, open **Connect**, select **Session pooler**, and copy its complete
connection string. Replace the password placeholder with the database password,
URL-encoding any special characters. It should have this shape:

```text
postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Save that complete value as `DATABASE_URL` in Render and set
`DB_CONNECTION_MODE=pooler`. Then deploy again with **Clear build cache &
deploy**. The Session pooler is IPv4-compatible and is appropriate for this
persistent Express service.

For the current Supabase project, the verified Session Pooler host is
`aws-1-ap-south-1.pooler.supabase.com`. The Render start script also detects
the project's old direct URL and safely switches it to this pooler before
running migrations and starting Express.

Set other production secrets in the Render dashboard. The equivalent
single-service Blueprint is in `backend/render.yaml`.
