import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';

const date = (value) => new Date(`${value}T00:00:00.000Z`);
const SESSION = '2026-27';
const DEMO_PASSWORD = process.env.CURRICULUM_MANAGER_SEED_PASSWORD || 'Curriculum@2026!';

const calendarTemplate = [
  ['2026-04-01','WORKING_DAY','Academic session commencement','ACADEMIC','Session opening and student orientation.','Academic session plan'],
  ['2026-04-11','EVENT','Parent orientation','MEETING','Orientation for parents and guardians.','School-scheduled event'],
  ['2026-05-16','VACATION','Summer vacation begins','VACATION','Summer break begins after classes.','School-scheduled; adjust to local climate guidance'],
  ['2026-07-01','WORKING_DAY','School reopening','ACADEMIC','Classes resume after summer vacation.','School-scheduled event'],
  ['2026-07-20','EXAM','Periodic Test I','EXAM','First periodic assessment window.','School assessment plan'],
  ['2026-08-15','HOLIDAY','Independence Day','CULTURAL','National celebration and flag-hoisting programme.','Fixed national observance: 15 August'],
  ['2026-09-05','EVENT','Teachers’ Day celebration','CULTURAL','Student-led celebration and appreciation activities.','Fixed observance: 5 September'],
  ['2026-09-21','EXAM','Half-yearly examinations','EXAM','Half-yearly examination window begins.','School assessment plan'],
  ['2026-10-02','HOLIDAY','Gandhi Jayanti','HOLIDAY','National holiday.','Fixed national holiday: 2 October'],
  ['2026-11-14','EVENT','Children’s Day celebration','CULTURAL','School-wide cultural and activity programme.','Fixed observance: 14 November'],
  ['2026-11-26','EVENT','Constitution Day programme','ACADEMIC','Civic learning and Constitution awareness activities.','Fixed observance: 26 November'],
  ['2026-12-23','VACATION','Winter vacation begins','VACATION','Winter break begins.','School-scheduled; adjust by region'],
  ['2027-01-26','HOLIDAY','Republic Day','CULTURAL','National celebration and school programme.','Fixed national observance: 26 January'],
  ['2027-02-01','EXAM','Pre-board examinations','EXAM','Pre-board examination window for senior classes.','School assessment plan'],
  ['2027-03-01','EXAM','Annual examinations','EXAM','Annual examination window begins.','School assessment plan'],
  ['2027-03-25','EVENT','Result declaration and PTM','RESULT','Result publication and parent-teacher meeting.','School-scheduled event'],
  ['2027-03-31','EVENT','Academic session completion','ACADEMIC','Close of the 2026-27 academic session.','Academic session plan'],
];

export async function ensureSchoolSecurityCurriculumDefaults(schoolId) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, schoolCode: true, schoolName: true } });
  if (!school) throw new Error('School not found while seeding curriculum defaults');
  const safeCode = school.schoolCode.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const loginId = `curriculum.manager@${safeCode}.schoolos`;
  let manager = await prisma.user.findUnique({ where: { email: loginId } });
  let managerCreated = false;
  if (!manager) {
    manager = await prisma.user.create({ data: { schoolId, email: loginId, contactEmail: null, password: await bcryptjs.hash(DEMO_PASSWORD, 12), name: 'Curriculum Manager', role: 'CURRICULUM_MANAGER', employeeId: 'CUR-001', isActive: true, mustChangePassword: true, securityQuestionsConfigured: true, securitySetupCompletedAt: new Date(), recoveryEnabled: true } });
    managerCreated = true;
  }
  const accountKey = `user:${manager.id}`;
  await prisma.userSecurityQuestion.createMany({ data: [
    { schoolId, accountKey, questionKey: 'FIRST_SCHOOL', answerHash: await bcryptjs.hash('demo first school', 10) },
    { schoolId, accountKey, questionKey: 'FIRST_BOOK', answerHash: await bcryptjs.hash('demo first book', 10) },
  ], skipDuplicates: true });
  await prisma.user.update({ where: { id: manager.id }, data: { securityQuestionsConfigured: true, securitySetupCompletedAt: manager.securitySetupCompletedAt || new Date(), recoveryEnabled: true } });

  for (const [calendarDate, dayType, title, eventType, description, sourceNote] of calendarTemplate) {
    await prisma.academicCalendarDay.upsert({
      where: { schoolId_calendarDate: { schoolId, calendarDate: date(calendarDate) } },
      create: { schoolId, calendarDate: date(calendarDate), endDate: date(calendarDate), academicSession: SESSION, dayType, title, eventType, description, isFullDay: true, isSchoolWide: true, isVisible: true, colorCategory: eventType, sourceNote, createdById: manager.id },
      update: { title, description, eventType, sourceNote, isVisible: true },
    });
  }

  let curriculum = await prisma.curriculum.findFirst({ where: { schoolId, name: 'CBSE School Curriculum', academicSession: SESSION } });
  if (!curriculum) curriculum = await prisma.curriculum.create({ data: { schoolId, name: 'CBSE School Curriculum', curriculumType: 'CBSE', academicSession: SESSION, description: 'School-specific CBSE-aligned curriculum. Review books and teaching sequence before publication.' } });
  let version = await prisma.curriculumVersion.findFirst({ where: { schoolId, curriculumId: curriculum.id, versionNumber: 1 } });
  if (!version) version = await prisma.curriculumVersion.create({ data: { schoolId, curriculumId: curriculum.id, versionNumber: 1, status: 'DRAFT', changeSummary: 'Initial school curriculum draft', createdById: manager.id } });
  let publisher = await prisma.publisher.findFirst({ where: { schoolId, name: 'NCERT' } });
  if (!publisher) publisher = await prisma.publisher.create({ data: { schoolId, name: 'NCERT', website: 'https://ncert.nic.in/' } });

  const assignments = await prisma.classSubject.findMany({ where: { class: { schoolId, deletedAt: null }, subject: { deletedAt: null } }, include: { class: true, subject: true }, take: 8, orderBy: { createdAt: 'asc' } });
  let books = 0;
  for (const assignment of assignments) {
    const title = `${assignment.subject.subjectName} – ${assignment.class.className}`;
    let book = await prisma.book.findFirst({ where: { schoolId, academicSession: SESSION, classId: assignment.classId, subjectId: assignment.subjectId, title } });
    if (!book) book = await prisma.book.create({ data: { schoolId, curriculumVersionId: version.id, publisherId: publisher.id, classId: assignment.classId, subjectId: assignment.subjectId, title, academicSession: SESSION, board: 'CBSE', resourceSource: 'VERIFIED_NCERT_CATALOGUE', resourcePreference: 'BOTH_CBSE_NCERT' } });
    else if (!book.curriculumVersionId) await prisma.book.update({ where: { id: book.id }, data: { curriculumVersionId: version.id } });
    await prisma.chapter.updateMany({ where: { schoolId, classId: assignment.classId, subjectId: assignment.subjectId, deletedAt: null }, data: { curriculumVersionId: version.id, bookId: book.id, academicSession: SESSION, resourcePreference: 'BOTH_CBSE_NCERT' } });
    books += 1;
  }
  const chapters = await prisma.chapter.count({ where: { schoolId, curriculumVersionId: version.id, deletedAt: null } });
  return { managerCreated, curriculumManager: { loginId, temporaryPassword: managerCreated ? DEMO_PASSWORD : null, mustChangePassword: true }, calendarEvents: calendarTemplate.length, curriculumId: curriculum.id, versionId: version.id, books, chapters };
}

export { SESSION as DEFAULT_SEED_SESSION };
