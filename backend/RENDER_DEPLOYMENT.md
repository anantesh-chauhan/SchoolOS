# Render deployment

Use `backend/render.yaml` as the Blueprint path in Render. It deploys only:

- `schoolos-api`: the Express API from `backend`
- `schoolos-frontend`: the Vite static application from `frontend`

## Required Blueprint values

Render prompts for these values when the Blueprint is created:

- API `DATABASE_URL`: the production PostgreSQL connection string. Use a pooled
  runtime connection when your provider supports it.
- API `CORS_ORIGINS`: the final static-site URL, for example
  `https://schoolos-frontend.onrender.com`. Separate multiple allowed origins
  with commas.
- Frontend `VITE_API_BASE_URL`: the final API URL including `/api`, for example
  `https://schoolos-api.onrender.com/api`.

Add Cloudinary and delivery-provider secrets in the Render dashboard if those
features are enabled. Never commit production secrets to an `.env` file.

The Blueprint disables demo instant login and in-process communication jobs.
Run scheduled delivery work in a dedicated worker before enabling it in a
scaled environment, otherwise each API instance would run the same job.

## Deploy

1. Push the repository to your Git provider.
2. In Render, create a Blueprint and set its path to `backend/render.yaml`.
3. Enter the required environment values above.
4. Deploy. The API health check is `/health`; the start command runs
   `prisma migrate deploy` before the API accepts traffic. This placement keeps
   the Blueprint compatible with Render's free web-service plan.
5. If Render assigns different URLs, update `CORS_ORIGINS` and
   `VITE_API_BASE_URL`, then redeploy both services.

The frontend rewrite sends client-side routes to `index.html`. Hashed assets
are cached for one year, while the HTML shell is always revalidated.
