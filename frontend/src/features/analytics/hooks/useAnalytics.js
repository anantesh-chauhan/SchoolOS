import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';

export const useStudentAnalytics = (studentId, filters = {}) => useQuery({
  queryKey: ['analytics', 'student', studentId, filters],
  queryFn: () => analyticsApi.student(studentId, filters),
  enabled: Boolean(studentId),
  staleTime: 45_000,
});

export const useSubjectAnalytics = (studentId, subjectId, filters = {}) => useQuery({
  queryKey: ['analytics', 'subject', studentId, subjectId, filters],
  queryFn: () => analyticsApi.subject(studentId, subjectId, filters),
  enabled: Boolean(studentId && subjectId),
  staleTime: 45_000,
});

export const useChapterAnalytics = (studentId, subjectId, chapterId, filters = {}) => useQuery({
  queryKey: ['analytics', 'chapter', studentId, subjectId, chapterId, filters],
  queryFn: () => analyticsApi.chapter(studentId, subjectId, chapterId, filters),
  enabled: Boolean(studentId && subjectId && chapterId),
  staleTime: 45_000,
});

