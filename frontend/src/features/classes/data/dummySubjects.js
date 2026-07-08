const iconBySubject = {
  English: '📘',
  Hindi: '📝',
  Mathematics: '📗',
  Science: '🔬',
  'Social Science': '🌍',
  Computer: '💻',
  'General Knowledge': '🧠',
  Drawing: '🎨',
  SST: '🗺️',
};

const teachersBySubject = {
  English: 'Meera Kapoor',
  Hindi: 'Ravi Prakash',
  Mathematics: 'Amit Singh',
  Science: 'Dr. Neelam Verma',
  'Social Science': 'Sonal Chauhan',
  Computer: 'Vikram Joshi',
  'General Knowledge': 'Kavita Rao',
  Drawing: 'Tarun Bhat',
  SST: 'Sonal Chauhan',
};

const baseSubjects = [
  { name: 'English', periodsPerWeek: 6, room: 204, status: 'Active' },
  { name: 'Hindi', periodsPerWeek: 5, room: 203, status: 'Active' },
  { name: 'Mathematics', periodsPerWeek: 6, room: 201, status: 'Active' },
  { name: 'Science', periodsPerWeek: 5, room: 205, status: 'Active' },
  { name: 'Social Science', periodsPerWeek: 5, room: 206, status: 'Active' },
  { name: 'Computer', periodsPerWeek: 4, room: 101, status: 'Active' },
  { name: 'General Knowledge', periodsPerWeek: 2, room: 207, status: 'Active' },
  { name: 'Drawing', periodsPerWeek: 2, room: 208, status: 'Active' },
];

const nurserySubjects = [
  { name: 'English', periodsPerWeek: 3, room: 12, status: 'Active' },
  { name: 'Hindi', periodsPerWeek: 2, room: 13, status: 'Active' },
  { name: 'Mathematics', periodsPerWeek: 3, room: 14, status: 'Active' },
  { name: 'Science', periodsPerWeek: 2, room: 15, status: 'Active' },
  { name: 'Drawing', periodsPerWeek: 2, room: 16, status: 'Active' },
  { name: 'General Knowledge', periodsPerWeek: 2, room: 17, status: 'Active' },
];

const secondaryExtras = [
  { name: 'SST', periodsPerWeek: 3, room: 209, status: 'Active' },
];

function normalizeStatus(subject) {
  if (!subject.status) return 'Active';
  return subject.status;
}

export function getSubjectsForClassSection(classId, sectionId) {
  const classNum = Number(classId);
  const letter = (sectionId || '').toString();

  // Hardcoded but realistic: later, replace this function with API/CMS.
  const isNursery = classNum === 1;
  let subjects = isNursery ? nurserySubjects : baseSubjects;

  if (!isNursery && (classNum === 5 || classNum === 6)) {
    subjects = [...baseSubjects, ...secondaryExtras];
  }

  // small variations per section
  const multiplier = letter === 'B' ? 0.95 : 1;

  return subjects.map((s, idx) => {
    const teacher = teachersBySubject[s.name] || teachersBySubject['Mathematics'];
    const icon = iconBySubject[s.name] || '📚';

    const periods = Math.max(2, Math.round(s.periodsPerWeek * multiplier));
    const room = idx % 2 === 0 ? s.room : s.room;

    return {
      id: `${classId}-${sectionId}-${s.name}`,
      name: s.name,
      icon,
      teacher,
      periodsPerWeek: periods,
      room,
      status: normalizeStatus(s),
    };
  });
}

