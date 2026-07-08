function avatarUrl(seed) {
  const text = seed.slice(0, 2).toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stop-color='#0ea5e9' />
          <stop offset='1' stop-color='#22c55e' />
        </linearGradient>
      </defs>
      <rect width='96' height='96' rx='22' fill='url(#g)' />
      <text x='48' y='60' font-size='30' text-anchor='middle' font-family='Arial' fill='white' font-weight='700'>${text}</text>
    </svg>
  `)}`;
}

const chapterStatus = {
  Completed: 'Completed',
  InProgress: 'In Progress',
  NotStarted: 'Not Started',
};

function normalizeStatus(status) {
  if (!status) return chapterStatus.NotStarted;
  return status;
}



function makeChapter({ subjectId, chapterIndex, chapterName }) {
  const chapterNumber = chapterIndex + 1;

  const statusOrder = ['Completed', 'InProgress', 'NotStarted'];
  const status =
    statusOrder[chapterIndex % statusOrder.length] === 'Completed'
      ? chapterStatus.Completed
      : statusOrder[chapterIndex % statusOrder.length] === 'InProgress'
        ? chapterStatus.InProgress
        : chapterStatus.NotStarted;

  const completion =
    status === chapterStatus.Completed
      ? 100
      : status === chapterStatus.InProgress
        ? 45 + (chapterIndex % 4) * 12
        : 0 + (chapterIndex % 3) * 0;

  const updatedAt = new Date(Date.now() - (chapterIndex + 1) * 86400000).toISOString();

  const resources = 3 + (chapterIndex % 5);
  const assignments = 1 + (chapterIndex % 4);

  return {
    id: `${subjectId}-ch-${chapterNumber}`,
    chapterNumber,
    chapterName,
    status: normalizeStatus(status),
    completion: Math.min(100, Math.max(0, completion)),
    estimatedClasses: 5 + (chapterIndex % 4),
    resources,
    assignments,
    updatedAt,
    resourcesCover: avatarUrl(chapterName),
  };
}

export function getChaptersForSubject({ classId, sectionId, subjectId, subjectName: _subjectName }) {


  // Deterministic chapter count variation.
  const countBase = 5;
  const extra = (Number(classId) + (sectionId || '').charCodeAt(0 || 0) + Number(subjectId)) % 3;
  const count = countBase + extra;

  const chapters = Array.from({ length: count }).map((_, i) => {
    const name = `Chapter ${i + 1}`;
    return makeChapter({ subjectId, chapterIndex: i, chapterName: name });
  });

  return chapters;
}

