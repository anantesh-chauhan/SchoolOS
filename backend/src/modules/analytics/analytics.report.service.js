import PDFDocument from 'pdfkit';
import prisma from '../../config/prisma.client.js';
import { getClassOrSectionOverview, getSchoolOverview, getStudentChapter, getStudentOverview, getStudentSubject } from './analytics.service.js';

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Prefix formula-like values to prevent spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const createStudentCsv = async ({ user, studentId, filters }) => {
  const data = await getStudentOverview({ user, studentId, ...filters });
  const rows = [
    ['SchoolOS Student Academic Analytics Report'],
    ['Student', data.student.name],
    ['Admission number', data.student.admissionNo],
    ['Class', data.student.className],
    ['Section', data.student.section],
    ['Academic session', data.student.academicSession],
    ['Generated at', data.generatedAt],
    ['Formula version', data.formulaVersion],
    ['Academic health', data.academicHealth.score],
    ['Data coverage', data.academicHealth.dataCoverage],
    ['Risk level', data.risk.riskLevel],
    [],
    ['Subject', 'Score', 'Coverage', 'Status', 'Homework completion', 'Quiz average', 'Weak chapters'],
    ...data.subjects.map((subject) => [
      subject.name, subject.score.score, subject.score.dataCoverage, subject.score.subjectStatus,
      subject.homeworkCompletion, subject.quizAverage, subject.weakChapters.length,
    ]),
    [],
    ['Risk reason', 'Severity', 'Explanation'],
    ...data.risk.reasons.map((item) => [item.code, item.severity, item.message]),
  ];
  return Buffer.from(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'utf8');
};

export const createStudentPdf = async ({ user, studentId, filters }) => {
  const [data, school] = await Promise.all([
    getStudentOverview({ user, studentId, ...filters }),
    prisma.school.findFirst({ where: { id: user.schoolId }, select: { schoolName: true, address: true, city: true, state: true } }),
  ]);
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: 'A4', info: { Title: `${data.student.name} academic analytics` } });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(19).fillColor('#111827').text(school?.schoolName || 'SchoolOS');
    document.fontSize(9).fillColor('#64748b').text([school?.address, school?.city, school?.state].filter(Boolean).join(', '));
    document.moveDown(1.3).fontSize(15).fillColor('#111827').text('Student Academic Analytics Report');
    document.fontSize(10).fillColor('#334155').text(`${data.student.name} · ${data.student.className}${data.student.section ? ` / ${data.student.section}` : ''} · ${data.student.academicSession}`);
    document.text(`Admission: ${data.student.admissionNo || '—'} · Roll: ${data.student.rollNumber || '—'}`);
    document.moveDown();
    document.fontSize(12).fillColor('#4f46e5').text(`Academic health: ${data.academicHealth.score ?? 'Insufficient data'} / 100`);
    document.fontSize(10).fillColor('#334155').text(`Data coverage: ${data.academicHealth.dataCoverage}% · Risk: ${data.risk.riskLevel} · Formula: ${data.formulaVersion}`);
    document.moveDown().fontSize(12).fillColor('#111827').text('How the score was calculated');
    data.academicHealth.components.forEach((item) => document.fontSize(9).fillColor('#475569').text(`• ${item.name}: ${item.rawScore}% × ${item.effectiveWeight}% = ${item.contribution}`));
    document.moveDown().fontSize(12).fillColor('#111827').text('Subject summary');
    data.subjects.forEach((subject) => document.fontSize(9).fillColor('#475569').text(`• ${subject.name}: ${subject.score.score ?? '—'}% · ${subject.score.subjectStatus} · ${subject.weakChapters.length} chapters need attention`));
    document.moveDown().fontSize(12).fillColor('#111827').text('Explainable risk review');
    if (!data.risk.reasons.length) document.fontSize(9).fillColor('#475569').text('No active risk reasons from available evidence.');
    data.risk.reasons.forEach((item) => document.fontSize(9).fillColor('#475569').text(`• ${item.severity}: ${item.message}`));
    document.moveDown().fontSize(12).fillColor('#111827').text('Recommended next steps');
    data.recommendations.slice(0, 8).forEach((item) => document.fontSize(9).fillColor('#475569').text(`• ${item.title} (${item.recommendedRole}): ${item.explanation}`));
    document.moveDown(1.5).fontSize(8).fillColor('#94a3b8').text(`Generated ${new Date(data.generatedAt).toLocaleString()} · Engagement indicators do not prove learning. Associations require professional review.`);
    document.end();
  });
};

const rowsToCsv = (rows) => Buffer.from(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`, 'utf8');

const simplePdf = ({ title, subtitle, sections, footer }) => new Promise((resolve, reject) => {
  const document = new PDFDocument({ margin: 48, size: 'A4', info: { Title: title } });
  const chunks = [];
  document.on('data', (chunk) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);
  document.fontSize(18).fillColor('#111827').text(title);
  if (subtitle) document.fontSize(10).fillColor('#64748b').text(subtitle);
  for (const section of sections) {
    document.moveDown().fontSize(12).fillColor('#111827').text(section.title);
    section.lines.forEach((line) => document.fontSize(9).fillColor('#475569').text(`• ${line}`));
  }
  document.moveDown().fontSize(8).fillColor('#94a3b8').text(footer || `Generated ${new Date().toLocaleString()}`);
  document.end();
});

export const createSubjectReport = async ({ user, studentId, subjectId, filters, format }) => {
  const data = await getStudentSubject({ user, studentId, subjectId, ...filters });
  if (format === 'csv') return rowsToCsv([
    ['Student subject analytics'], ['Student', data.student.name], ['Subject', data.subject.name],
    ['Score', data.subject.score.score], ['Coverage', data.subject.score.dataCoverage], ['Status', data.subject.score.subjectStatus],
    ['Class average', data.subject.classAverage], ['Difference from class average', data.subject.differenceFromClassAverage],
    [], ['Chapter', 'Health', 'Coverage', 'Status', 'Homework', 'Quiz'],
    ...data.chapters.map((row) => [row.title, row.health.score, row.health.dataCoverage, row.health.chapterStatus, row.homeworkCompletion, row.quizAverage]),
  ]);
  return simplePdf({
    title: `${data.subject.name} Subject Analytics`,
    subtitle: `${data.student.name} · ${data.student.className} ${data.student.section || ''}`,
    sections: [
      { title: 'Subject summary', lines: [`Score: ${data.subject.score.score ?? '—'}%`, `Coverage: ${data.subject.score.dataCoverage}%`, `Status: ${data.subject.score.subjectStatus}`, `Class average: ${data.subject.classAverage ?? '—'}%`] },
      { title: 'Chapter summary', lines: data.chapters.map((row) => `${row.title}: ${row.health.score ?? '—'}% · ${row.health.chapterStatus}`) },
    ],
    footer: `Formula ${data.formulaVersion}. Missing components are excluded rather than scored as zero.`,
  });
};

export const createChapterReport = async ({ user, studentId, subjectId, chapterId, filters, format }) => {
  const data = await getStudentChapter({ user, studentId, subjectId, chapterId, ...filters });
  const chapter = data.chapter;
  const evidence = [
    ['Chapter health', chapter.health.score], ['Coverage', chapter.health.dataCoverage], ['Status', chapter.health.chapterStatus],
    ['Attendance', chapter.attendance], ['Homework completion', chapter.homeworkCompletion], ['Quiz average', chapter.quizAverage],
    ['Self-understanding', chapter.selfUnderstanding], ['Teacher evaluation', chapter.teacherEvaluation], ['Resource completion', chapter.resourceCompletionRate],
  ];
  if (format === 'csv') return rowsToCsv([['Student chapter analytics'], ['Student', data.student.name], ['Subject', data.subject.name], ['Chapter', chapter.title], ...evidence]);
  return simplePdf({
    title: `${chapter.title} Chapter Analytics`,
    subtitle: `${data.student.name} · ${data.subject.name}`,
    sections: [
      { title: 'Evidence summary', lines: evidence.map(([name, value]) => `${name}: ${value ?? '—'}${typeof value === 'number' ? '%' : ''}`) },
      { title: 'Learning outcomes', lines: chapter.learningOutcomes?.map((row) => `${row.title}: ${row.score ?? 'Not assessed'}${row.score !== null ? '%' : ''}`) || ['No mapped outcome evidence.'] },
    ],
  });
};

export const createInstitutionReport = async ({ user, classId, sectionId, academicSessionId, format }) => {
  const data = classId
    ? await getClassOrSectionOverview({ user, classId, sectionId, academicSessionId })
    : await getSchoolOverview({ user, academicSessionId });
  const title = classId ? `${data.class.name}${data.section ? ` Section ${data.section.name}` : ''} Analytics` : 'School Academic Analytics';
  if (format === 'csv') return rowsToCsv([
    [title], ['Academic session', data.academicSession?.name], ['Students', data.studentCount],
    ['Average academic health', data.averages.academicHealth], ['Average attendance', data.averages.attendance], ['Data coverage', data.averages.dataCoverage],
    [], ['Student', 'Class', 'Section', 'Attendance', 'Academic health', 'Risk', 'Trend', 'Weak chapters'],
    ...data.items.map((row) => [row.name, row.className, row.section, row.attendance, row.academicHealth, row.riskLevel, row.trend, row.weakChapters]),
  ]);
  return simplePdf({
    title,
    subtitle: data.academicSession?.name,
    sections: [
      { title: 'Summary', lines: [`Students: ${data.studentCount}`, `Academic health: ${data.averages.academicHealth ?? '—'}%`, `Attendance: ${data.averages.attendance ?? '—'}%`, `Data coverage: ${data.averages.dataCoverage ?? '—'}%`] },
      { title: 'Risk distribution', lines: data.riskDistribution.map((row) => `${row.riskLevel}: ${row.count}`) },
      { title: 'Student summary', lines: data.items.slice(0, 40).map((row) => `${row.name}: ${row.academicHealth ?? '—'}% · ${row.riskLevel}`) },
    ],
    footer: 'Finalized academic scores use immutable student snapshots; live attendance remains separately identified.',
  });
};
