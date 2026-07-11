import 'dotenv/config';
import crypto from 'node:crypto';
import bcryptjs from 'bcryptjs';
import pg from 'pg';

const DEMO_PASSWORD = 'admin123';
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 10);
  const rows = await client.query(`
    select
      st.id as "studentId",
      st."schoolId",
      st."parentUserId",
      st."fatherName",
      st."studentFirstName",
      st."studentLastName",
      c.id as "classId",
      sec.id as "sectionId"
    from "Student" st
    join "Class" c
      on c."schoolId" = st."schoolId"
     and c."className" = st."className"
     and c."deletedAt" is null
    join "Section" sec
      on sec."schoolId" = st."schoolId"
     and sec."classId" = c.id
     and sec."sectionName" = st."section"
     and sec."deletedAt" is null
    where st."isActive" = true
      and st."parentUserId" is not null
    order by st."schoolId", c."classOrder", sec."sectionOrder", st."rollNumber"
  `);

  let createdOrUpdated = 0;
  for (const row of rows.rows) {
    const studentName = [row.studentFirstName, row.studentLastName].filter(Boolean).join(' ');
    await client.query(`
      insert into "User" (
        id, email, password, name, role, "schoolId", "classId", "sectionId", "isActive", "createdAt", "updatedAt"
      )
      values ($1, $2, $3, $4, 'PARENT', $5, $6, $7, true, now(), now())
      on conflict (email) do update set
        password = excluded.password,
        name = excluded.name,
        role = 'PARENT',
        "schoolId" = excluded."schoolId",
        "classId" = excluded."classId",
        "sectionId" = excluded."sectionId",
        "isActive" = true,
        "updatedAt" = now()
    `, [
      crypto.randomUUID(),
      row.parentUserId,
      passwordHash,
      `${row.fatherName || 'Parent'} (${studentName})`,
      row.schoolId,
      row.classId,
      row.sectionId,
    ]);
    createdOrUpdated += 1;
  }

  console.log(JSON.stringify({ parentUsersCreatedOrUpdated: createdOrUpdated }, null, 2));
} finally {
  await client.end();
}
