const maleNames = [
  'Aarav Sharma',
  'Vivaan Gupta',
  'Vihaan Mehta',
  'Kabir Singh',
  'Arjun Verma',
  'Dhruv Kulkarni',
  'Aditya Rao',
  'Rohan Joshi',
  'Ishaan Nair',
  'Neil Patel',
];

const femaleNames = [
  'Ananya Singh',
  'Aanya Gupta',
  'Meera Kapoor',
  'Sara Khan',
  'Nandini Iyer',
  'Diya Shukla',
  'Ira Saxena',
  'Khushi Yadav',
  'Riya Chauhan',
  'Advika Menon',
];

const houses = ['Blue House', 'Red House', 'Green House', 'Yellow House'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'O+', 'O-'];

function avatarUrl(seed) {
  // Lightweight inline avatar placeholder using a data URI.
  // Later replace with real image URLs.
  const text = seed.slice(0, 2).toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='#0ea5e9' />
          <stop offset='1' stop-color='#22c55e' />
        </linearGradient>
      </defs>
      <rect width='120' height='120' rx='28' fill='url(#g)' />
      <text x='60' y='68' font-size='38' text-anchor='middle' font-family='Arial' fill='white' font-weight='700'>${text}</text>
    </svg>
  `)}`;
}

function pick(arr, idx) {
  return arr[idx % arr.length];
}

function buildStudents({ classId, sectionId }) {
  const letter = (sectionId || '').toString();

  // 5–10 students as requested. Variations based on class/section to keep it realistic.
  const count = letter === 'C' ? 6 : letter === 'B' ? 9 : 8;

  const genders = [];
  for (let i = 0; i < count; i++) {
    genders.push(i % 2 === 0 ? 'Male' : 'Female');
  }

  const baseRollStart = letter === 'B' ? 11 : 1;

  const statuses = ['Present', 'Present', 'Present', 'Absent'];
  const attendance = (i) => {
    const base = letter === 'B' ? 93 : 95;
    const delta = (i % 4) * 1.2;
    const v = base - delta;
    return Math.round(v);
  };

  const housesFor = (i) => pick(houses, i + Number(classId));

  const subjectMapByClass = {
    // Must match dummy subjects produced by getSubjectsForClassSection
    '1': ['English', 'Hindi', 'Mathematics', 'Science', 'Drawing', 'General Knowledge'],
    '2': ['English', 'Hindi', 'Mathematics', 'Science', 'Drawing', 'General Knowledge'],
    '3': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'General Knowledge', 'Drawing'],
    '4': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'General Knowledge', 'Drawing'],
    '5': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'General Knowledge', 'Drawing', 'SST'],
    '6': ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'General Knowledge', 'Drawing', 'SST'],
  };

  const studiedBy = subjectMapByClass[String(classId)] || subjectMapByClass['3'];

  return Array.from({ length: count }).map((_, i) => {
    const rollNo = String(i + baseRollStart).padStart(2, '0');
    const isMale = genders[i] === 'Male';
    const name = isMale ? pick(maleNames, i + 2) : pick(femaleNames, i + 3);
    const id = `${classId}-${sectionId}-stu-${rollNo}`;

    const admissionNo = `DCS-${String(Number(classId) * 1000 + Number(sectionId?.charCodeAt(0) || 65)).slice(-4)}${String(i + 1).padStart(2, '0')}`;

    const fatherName = isMale ? pick(maleNames, i + 5).split(' ')[0] + ' Rao' : pick(maleNames, i + 6).split(' ')[0] + ' Kumar';
    const phone = `9${pick([1, 2, 3, 4, 5], i)}${pick([0, 1, 2, 3, 4], i + 1)}${pick([0, 1, 2, 3, 4], i + 2)}${pick([0, 1, 2, 3, 4], i + 3)}${pick([0, 1, 2, 3, 4], i + 4)}${pick([0, 1, 2, 3, 4], i + 5)}${pick([0, 1, 2, 3, 4], i + 6)}${pick([0, 1, 2, 3, 4], i + 7)}`;

    const status = statuses[i % statuses.length];
    const att = attendance(i);

    // If Absent, attendance should be lower.
    const attendancePercent = status === 'Absent' ? Math.min(att - 8, 88) : att;

    const subjects = studiedBy.filter((_, idx) => (idx + i) % 2 === 0).slice(0, 7);

    const dob = `201${(i % 4) + 1}-${String((i % 9) + 1).padStart(2, '0')}-0${(i % 8) + 1}`;

    return {
      id,
      rollNo: `Roll ${rollNo}`,
      name,
      gender: isMale ? 'Male' : 'Female',
      photo: avatarUrl(name),
      admissionNo,
      fatherName,
      phone,
      bloodGroup: pick(bloodGroups, i + 1),
      dob,
      house: housesFor(i),
      status,
      attendance: `${attendancePercent}%`,
      subjects: subjects.map((s) => ({ name: s })),
      parent: {
        name: fatherName,
        phone,
      },
      // future-ready hooks
      teacher: null,
      attendanceHistory: [],
    };
  });
}

export function getStudentsForClassSection(classId, sectionId) {
  const list = buildStudents({ classId, sectionId });
  // ensure 5–10
  return list.slice(0, 10);
}

