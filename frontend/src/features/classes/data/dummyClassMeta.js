const ACADEMIC_SESSIONS = [
  '2026-27',
  '2025-26',
  '2024-25',
];

const classTeachersByClassId = {
  '1': 'Rahul Sharma',
  '2': 'Neha Verma',
  '3': 'Amit Singh',
  '4': 'Suresh Kumar',
  '5': 'Priya Nair',
  '6': 'Rohit Mehta',
};

const classLabelByClassId = {
  '1': 'Nursery',
  '2': 'Class 1',
  '3': 'Class 6',
  '4': 'Class 8',
  '5': 'Class 10',
  '6': 'Class 12',
};

const sessionBySectionKey = {
  A: '2026-27',
  B: '2026-27',
  C: '2026-27',
  D: '2026-27',
};

export function getClassMeta(classId, sectionId) {
  const sectionLetter = (sectionId || '').toString();

  const label = classLabelByClassId[classId] || `Class ${classId}`;
  const teacher = classTeachersByClassId[classId] || 'Rahul Sharma';
  const academicSession = sessionBySectionKey[sectionLetter] || ACADEMIC_SESSIONS[0];

  const totalStudentsByKey = {
    '1|A': 26,
    '2|A': 30,
    '3|A': 32,
    '3|B': 34,
    '4|A': 36,
    '4|B': 33,
    '5|A': 28,
    '5|B': 30,
  };

  const subjectsByKey = {
    '3|A': 8,
    '3|B': 8,
    '4|A': 9,
    '4|B': 9,
    '5|A': 10,
    '5|B': 10,
  };

  const attendanceByKey = {
    '1|A': 92,
    '2|A': 93,
    '3|A': 95,
    '3|B': 94,
    '4|A': 94,
    '4|B': 93,
    '5|A': 96,
    '5|B': 95,
  };

  const key = `${classId}|${sectionLetter}`;
  return {
    academicSession,
    className: label,
    sectionName: `Section ${sectionLetter}`,
    classTeacher: teacher,
    totalStudents: totalStudentsByKey[key] ?? 30,
    subjectsCount: subjectsByKey[key] ?? 8,
    attendancePercent: attendanceByKey[key] ?? 94,
    // convenient tokens for display
    classId,
    sectionId,
    sectionLetter,
  };
}

