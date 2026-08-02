# Modular Prisma schema

The canonical Prisma schema is the `backend/prisma` directory. Prisma 5.22 supports schema folders through the `prismaSchemaFolder` preview feature, enabled in `backend/prisma/schema.prisma`. The generator and PostgreSQL datasource remain in that main file; all models and enums live in `backend/prisma/models`.

Domain files are:

- `academic-structure.prisma`
- `analytics.prisma`
- `attendance.prisma`
- `auth-tenancy.prisma`
- `communication.prisma`
- `curriculum.prisma`
- `enums.prisma`
- `examinations.prisma`
- `fees.prisma`
- `homework-resources.prisma`
- `hr-payroll.prisma`
- `issues.prisma`
- `public-platform.prisma`
- `security.prisma`
- `student-learning.prisma`
- `widgets-content.prisma`

The existing `backend/prisma/migrations` directory remains beside the main schema file, as required by Prisma schema-folder discovery. No migration was created for this organizational change.

To add a model or enum, place it in the owning domain file. Cross-file relations require no imports. Do not duplicate a declaration or move the generator/datasource out of `schema.prisma`. Then run:

```powershell
cd backend
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:status
```

For an intentional database change, use `npm run prisma:migrate -- --name <change-name>` in development, review the generated SQL, and deploy committed migrations with `npx prisma migrate deploy --schema prisma`. Never use a reset against shared or production data.

