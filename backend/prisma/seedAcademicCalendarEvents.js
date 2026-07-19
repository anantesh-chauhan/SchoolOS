import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const SESSION = '2026-27';
const atMidnightUtc = (value) => new Date(`${value}T00:00:00.000Z`);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  query_timeout: 30000,
});

// Insert-only template: existing school/date rows are deliberately left untouched.
const eventTemplate = [
  ['2026-04-01', 'WORKING_DAY', 'New academic session begins', 'ACADEMIC', 'Welcome assembly, class orientation and distribution of the academic plan.'],
  ['2026-04-22', 'EVENT', 'Earth Day activities', 'ACTIVITY', 'Campus cleanliness drive and student sustainability activities.'],
  ['2026-05-09', 'EVENT', 'Summer enrichment showcase', 'ACTIVITY', 'Project and club showcase before the summer break.'],
  ['2026-05-18', 'VACATION', 'Summer vacation begins', 'VACATION', 'Summer vacation begins after regular school hours.'],
  ['2026-06-29', 'WORKING_DAY', 'School reopens after summer break', 'ACADEMIC', 'Classes resume according to the regular timetable.'],
  ['2026-07-20', 'EXAM', 'Periodic Test I begins', 'EXAM', 'First periodic assessment cycle for the academic session.'],
  ['2026-07-31', 'EVENT', 'Investiture ceremony', 'CEREMONY', 'Student council members receive their badges and responsibilities.'],
  ['2026-08-15', 'HOLIDAY', 'Independence Day', 'NATIONAL_HOLIDAY', 'National observance; school programme details may be announced separately.'],
  ['2026-08-29', 'EVENT', 'National Sports Day', 'SPORTS', 'Inter-house sports and fitness activities for students.'],
  ['2026-09-05', 'EVENT', "Teachers' Day celebration", 'CELEBRATION', 'Student-led programme celebrating teachers and mentors.'],
  ['2026-09-21', 'EXAM', 'Half-yearly examinations begin', 'EXAM', 'Half-yearly assessment cycle begins; follow the published timetable.'],
  ['2026-10-02', 'HOLIDAY', 'Gandhi Jayanti', 'NATIONAL_HOLIDAY', 'School closed for the national holiday.'],
  ['2026-10-23', 'EVENT', 'Parent-teacher meeting', 'MEETING', 'Academic progress discussion following half-yearly assessments.'],
  ['2026-11-14', 'EVENT', "Children's Day celebration", 'CELEBRATION', 'School-wide cultural programme, games and student activities.'],
  ['2026-11-26', 'EVENT', 'Constitution Day programme', 'ACADEMIC', 'Civic learning activities and reading of the Preamble.'],
  ['2026-12-18', 'EVENT', 'Annual day', 'CULTURAL', 'Annual cultural showcase and student recognition programme.'],
  ['2026-12-23', 'VACATION', 'Winter vacation begins', 'VACATION', 'Winter break begins after regular school hours.'],
  ['2027-01-04', 'WORKING_DAY', 'School reopens after winter break', 'ACADEMIC', 'Regular classes resume after winter vacation.'],
  ['2027-01-12', 'EVENT', 'National Youth Day activities', 'ACTIVITY', 'Leadership, service and youth development activities.'],
  ['2027-01-26', 'HOLIDAY', 'Republic Day', 'NATIONAL_HOLIDAY', 'National observance; school programme details may be announced separately.'],
  ['2027-02-01', 'EXAM', 'Pre-board examinations begin', 'EXAM', 'Pre-board assessment cycle for eligible senior classes.'],
  ['2027-02-20', 'EVENT', 'Science and innovation exhibition', 'ACADEMIC', 'Student models, experiments and innovation projects on display.'],
  ['2027-03-01', 'EXAM', 'Annual examinations begin', 'EXAM', 'Year-end examinations begin according to the published timetable.'],
  ['2027-03-25', 'EVENT', 'Result declaration and PTM', 'RESULT', 'Report cards are issued followed by parent-teacher interaction.'],
  ['2027-03-31', 'EVENT', 'Academic session closes', 'ACADEMIC', 'Formal completion of the 2026-27 academic session.'],
];

try {
  await client.connect();
  const schoolsResult = await client.query('SELECT "id", "schoolCode", "schoolName" FROM "School" ORDER BY "schoolName" ASC');
  const schools = schoolsResult.rows;

  if (!schools.length) {
    console.log('No schools found. Nothing was seeded.');
  }

  let insertedTotal = 0;
  for (const school of schools) {
    await client.query('BEGIN');
    let inserted = 0;
    try {
      for (const [calendarDate, dayType, title, eventType, description] of eventTemplate) {
        const result = await client.query(`
          INSERT INTO "AcademicCalendarDay" (
            "id", "schoolId", "calendarDate", "endDate", "academicSession", "dayType", "title",
            "eventType", "description", "colorCategory", "isFullDay", "isSchoolWide", "isVisible",
            "sourceNote", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $3, $4, CAST($5 AS "CalendarDayType"), $6, $7, $8, $5, true, true, true, $9, NOW(), NOW())
          ON CONFLICT ("schoolId", "calendarDate") DO NOTHING
        `, [
          `calendar_seed_${randomUUID()}`,
          school.id,
          atMidnightUtc(calendarDate),
          SESSION,
          dayType,
          title,
          eventType,
          description,
          'SchoolOS additive academic calendar seed (2026-27)',
        ]);
        inserted += result.rowCount;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const skipped = eventTemplate.length - inserted;
    insertedTotal += inserted;
    console.log(`${school.schoolCode} (${school.schoolName}): inserted ${inserted}, preserved ${skipped} existing date(s)`);
  }

  console.log(`Academic calendar seed complete: inserted ${insertedTotal} event(s) across ${schools.length} school(s). No existing data was changed or deleted.`);
} finally {
  await client.end().catch(() => {});
}
