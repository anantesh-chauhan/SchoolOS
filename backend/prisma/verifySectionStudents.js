import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const bySchool = await client.query(`
  select
    sc."schoolName",
    sc."schoolCode",
    count(distinct sec.id)::int as sections,
    count(distinct st.id)::int as students,
    count(distinct su.id)::int as student_users,
    count(distinct pu.id)::int as parent_users
  from "School" sc
  left join "Section" sec
    on sec."schoolId" = sc.id
   and sec."deletedAt" is null
  left join "Class" c
    on c.id = sec."classId"
  left join "Student" st
    on st."schoolId" = sc.id
   and st."className" = c."className"
   and st."section" = sec."sectionName"
   and st."isActive" = true
  left join "User" su
    on su.email = st."studentUserId"
   and su.role = 'STUDENT'
   and su."isActive" = true
  left join "User" pu
    on pu.email = st."parentUserId"
   and pu.role = 'PARENT'
   and pu."isActive" = true
  group by sc.id
  order by sc."schoolName"
`);

const weakSections = await client.query(`
  select
    sc."schoolName",
    c."className",
    sec."sectionName",
    count(st.id)::int as students
  from "Section" sec
  join "School" sc on sc.id = sec."schoolId"
  join "Class" c on c.id = sec."classId"
  left join "Student" st
    on st."schoolId" = sec."schoolId"
   and st."className" = c."className"
   and st."section" = sec."sectionName"
   and st."isActive" = true
  where sec."deletedAt" is null
  group by sc."schoolName", c."classOrder", c."className", sec."sectionOrder", sec."sectionName"
  having count(st.id) < 8
  order by sc."schoolName", c."classOrder", sec."sectionOrder"
  limit 50
`);

const samples = await client.query(`
  select
    st."studentFirstName",
    st."studentLastName",
    st."className",
    st."section",
    st."studentUserId",
    st."parentUserId"
  from "Student" st
  where st."isActive" = true
    and st."studentUserId" is not null
    and st."parentUserId" is not null
  order by st."createdAt" desc
  limit 10
`);

console.log(JSON.stringify({
  bySchool: bySchool.rows,
  weakSections: weakSections.rows,
  samples: samples.rows,
}, null, 2));

await client.end();
