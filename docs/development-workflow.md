# Development and verification workflow

Install dependencies separately in `backend`, `frontend`, and `school-frontend` with `npm ci`.

Common checks:

```powershell
cd backend
npm test
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:status

cd ../frontend
npm run lint
npm run build

cd ../school-frontend
npm run lint
npm run build
```

The backend production start path is `npm run start:render`. It runs `prisma migrate deploy` before importing the server. The backend `postinstall` script generates the client from the schema directory. The backend aggregate build installs, builds, and copies the main frontend into `backend/public`.

For safe refactors, keep facade exports and route definitions stable, move one responsibility at a time, run syntax and focused contract tests after each move, and compare the final schema and endpoint inventory. Do not edit `backend/src/generated/prisma` or built assets in `backend/public` manually.

