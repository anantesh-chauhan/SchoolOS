import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ACADEMIC_STRUCTURE_QUERY_KEY, academicStructureService } from '../services/academicStructureService';

const byName = (a, b) => String(a.subjectName || '').localeCompare(String(b.subjectName || ''));

export function useAcademicStructure(options = {}) {
  const query = useQuery({
    queryKey: ACADEMIC_STRUCTURE_QUERY_KEY,
    queryFn: academicStructureService.list,
    staleTime: 30_000,
    ...options,
  });

  const structure = query.data?.data || {};
  const classes = structure.classes || [];
  const subjects = structure.subjects || [];

  const subjectMappings = useMemo(() => subjects.map((subject) => {
    const classSubjects = [];
    const sectionSubjects = [];

    classes.forEach((classRow) => {
      (classRow.classSubjects || []).forEach((assignment) => {
        if (assignment.subjectId === subject.id) {
          classSubjects.push({
            ...assignment,
            class: {
              id: classRow.id,
              className: classRow.className,
              classOrder: classRow.classOrder,
            },
          });
        }
      });

      (classRow.sections || []).forEach((section) => {
        (section.sectionSubjects || []).forEach((assignment) => {
          if (assignment.subjectId === subject.id) {
            sectionSubjects.push({
              ...assignment,
              section: {
                id: section.id,
                sectionName: section.sectionName,
                class: {
                  id: classRow.id,
                  className: classRow.className,
                  classOrder: classRow.classOrder,
                },
              },
            });
          }
        });
      });
    });

    return { ...subject, classSubjects, sectionSubjects };
  }).sort(byName), [classes, subjects]);

  return {
    ...query,
    structure,
    classes,
    subjects,
    subjectMappings,
    getClass: (classId) => classes.find((row) => row.id === classId) || null,
    getSections: (classId) => classes.find((row) => row.id === classId)?.sections || [],
    getSection: (classId, sectionId) => (
      classes.find((row) => row.id === classId)?.sections || []
    ).find((row) => row.id === sectionId) || null,
    getClassSubjects: (classId) => classes.find((row) => row.id === classId)?.classSubjects || [],
    getSectionSubjects: (classId, sectionId) => (
      classes.find((row) => row.id === classId)?.sections || []
    ).find((row) => row.id === sectionId)?.sectionSubjects || [],
    getClassWeeklyRequirements: (classId) => (
      classes.find((row) => row.id === classId)?.subjectWeeklyRequirements || []
    ),
    getSectionWeeklyRequirements: (classId, sectionId) => (
      classes.find((row) => row.id === classId)?.sections || []
    ).find((row) => row.id === sectionId)?.subjectWeeklyRequirements || [],
  };
}

export const invalidateAcademicStructure = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ACADEMIC_STRUCTURE_QUERY_KEY });
};
