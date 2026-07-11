import apiClient from '../../../services/api';

export const subjectDetailsDataService = {
  async getDashboardPayload({ classId, sectionId, subjectId }) {
    const response = await apiClient.get('/academic-structure/subject-dashboard', {
      params: { classId, sectionId, subjectId },
    });

    return response.data?.data || {
      meta: null,
      subject: null,
      chapters: [],
      stats: {
        totalChapters: 0,
        completedChapters: 0,
        completionPct: 0,
        upcomingChapters: 0,
        assignments: 0,
        homework: 0,
        resources: 0,
      },
    };
  },
  async getChapterPayload({ classId, sectionId, subjectId, chapterId }) {
    const response = await apiClient.get('/academic-structure/chapter-dashboard', {
      params: { classId, sectionId, subjectId, chapterId },
    });

    return response.data?.data || {
      meta: null,
      subject: null,
      chapter: null,
      resources: [],
    };
  },
};

