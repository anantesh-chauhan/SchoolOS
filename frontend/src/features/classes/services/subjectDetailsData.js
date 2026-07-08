import { getChaptersForSubject } from '../data/dummyChapters';
import { getClassMeta } from '../data/dummyClassMeta';
import { getSubjectsForClassSection } from '../data/dummySubjects';

export const subjectDetailsDataService = {
  async getDashboardPayload({ classId, sectionId, subjectId }) {
    const meta = getClassMeta(classId, sectionId);
    const subjects = getSubjectsForClassSection(classId, sectionId);

    const subject = subjects.find((s) => String(s.id) === String(subjectId))
      || subjects.find((s) => s.id === subjectId)
      || subjects[0];


    const chapters = getChaptersForSubject({ classId, sectionId, subjectId: subject?.id, subjectName: subject?.name });

    // Dummy totals
    const totalChapters = chapters.length;
    const completedChapters = chapters.filter((c) => c.status === 'Completed').length;
    const completionPct = totalChapters === 0 ? 0 : Math.round((completedChapters / totalChapters) * 100);

    return {
      meta,
      subject: {
        id: subject.id,
        name: subject.name,
        teacher: subject.teacher,
        icon: subject.icon,
      },
      chapters,
      stats: {
        totalChapters,
        completedChapters,
        completionPct,
        upcomingChapters: Math.max(0, totalChapters - completedChapters),
        assignments: 12,
        homework: 9,
        resources: 26,
      },
    };
  },
};

