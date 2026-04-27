# Academic Structure and Weekly Period Management Module

## API Endpoints

Base: `/api/academic-structure`

- `GET /`
  - Returns levels, classes/sections, subjects/components, streams, activities, period definitions, labs.
- `POST /bootstrap`
  - Applies the default template for the scoped school.
  - Roles: `PLATFORM_OWNER`, `SCHOOL_OWNER`, `ADMIN`.
- `GET /default-template`
  - Returns platform default template payload.
  - Roles: `PLATFORM_OWNER`.
- `POST /push-template`
  - Platform owner pushes default template to target school (`schoolId` required in body).
  - Roles: `PLATFORM_OWNER`.
- `POST /periods`
  - Upsert 48 period rows (6 days x 8 periods).
  - Roles: `SCHOOL_OWNER`, `ADMIN`.
- `GET /activities`
  - List optional activities with enrollment counts.
  - Roles: `SCHOOL_OWNER`, `ADMIN`, `TEACHER`.
- `POST /activities`
  - Create/update optional activity.
  - Roles: `SCHOOL_OWNER`, `ADMIN`.
- `POST /activities/enroll`
  - Enroll student to activity with capacity validation.
  - Roles: `SCHOOL_OWNER`, `ADMIN`.
- `POST /teacher-components/assign`
  - Assign multi-teacher component loads for one subject in class/section.
  - Roles: `SCHOOL_OWNER`, `ADMIN`.
- `GET /validate`
  - Returns module validation report.
  - Roles: `PLATFORM_OWNER`, `SCHOOL_OWNER`, `ADMIN`.

## Seed Data Coverage

The seed now includes:

- Academic levels:
  - Pre-Primary, Primary, Middle, Secondary, Senior Secondary.
- Classes:
  - LKG, UKG, Class 1 to Class 12.
- Streams:
  - PCM, PCB, PCMB, COM, HUM.
- Subject master:
  - Parent-child hierarchy for Science and Social Science.
  - Lab subjects and activities.
- Class/section weekly requirements:
  - Exact 48 periods/week.
- Optional activities:
  - Sports, Yoga, Dance, Music, Drama, Robotics, Coding Club, Debate, Art Club, Chess, Photography.
- Period structure:
  - Monday-Saturday, 8 periods/day, last period as activity.
- Multi-teacher support sample:
  - Science component load split for Class 9-10 sections.
- Lab support:
  - Lab rooms and lab double-period rules.

## Validation Rules Implemented

- Weekly total must equal 48 for each class/section scope.
- Teacher overlap detection by day/time.
- Class/section overlap detection by day/time.
- Maximum 2 periods/day for same subject in a timetable.
- Lab periods must contain at least one consecutive pair.
- Activity slots must follow optional activity constraints.

## Migrations and SQL

- Prisma migration script:
  - `backend/prisma/migrations/20260427_academic_structure_module/migration.sql`
- Reference SQL schema:
  - `backend/database/academic_structure_module.sql`
