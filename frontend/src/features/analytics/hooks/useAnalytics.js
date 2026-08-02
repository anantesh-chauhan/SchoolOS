import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import { queryKeys } from '../../../lib/queryClient';

export const useStudentAnalytics = (studentId, filters = {}) => useQuery({
  queryKey: queryKeys.analytics('student', studentId, filters),
  queryFn: ({ signal }) => analyticsApi.student(studentId, filters, signal),
  enabled: Boolean(studentId),
  staleTime: 45_000,
});

export const useSubjectAnalytics = (studentId, subjectId, filters = {}) => useQuery({
  queryKey: queryKeys.analytics('subject', studentId, subjectId, filters),
  queryFn: ({ signal }) => analyticsApi.subject(studentId, subjectId, filters, signal),
  enabled: Boolean(studentId && subjectId),
  staleTime: 45_000,
});

export const useChapterAnalytics = (studentId, subjectId, chapterId, filters = {}) => useQuery({
  queryKey: queryKeys.analytics('chapter', studentId, subjectId, chapterId, filters),
  queryFn: ({ signal }) => analyticsApi.chapter(studentId, subjectId, chapterId, filters, signal),
  enabled: Boolean(studentId && subjectId && chapterId),
  staleTime: 45_000,
});

