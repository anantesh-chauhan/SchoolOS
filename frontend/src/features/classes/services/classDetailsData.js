import { getClassMeta } from '../data/dummyClassMeta';
import { getSubjectsForClassSection } from '../data/dummySubjects';
import { getStudentsForClassSection } from '../data/dummyStudents';

// This file is the only thing UI needs to touch.
// Later you can replace implementations with API calls
// without changing the components/page.

export const classDetailsDataService = {
  async getDashboardPayload({ classId, sectionId }) {
    const meta = getClassMeta(classId, sectionId);
    const subjects = getSubjectsForClassSection(classId, sectionId);
    const students = getStudentsForClassSection(classId, sectionId);

    return {
      meta,
      subjects,
      students,
    };
  },
};

