export const ISSUE_CATEGORIES = ['AUTHENTICATION','DASHBOARD','STUDENT_MANAGEMENT','TEACHER_MANAGEMENT','PARENT_PORTAL','CLASS_MANAGEMENT','SUBJECT_MANAGEMENT','CHAPTER_MANAGEMENT','TIMETABLE','ATTENDANCE','ANALYTICS','FEES','NOTIFICATIONS','PUBLIC_WEBSITE','MEDIA_UPLOAD','PERFORMANCE','UI_UX','INCORRECT_DATA','FEATURE_REQUEST','GENERAL_FEEDBACK','OTHER'];
export const ISSUE_PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'];
export const ISSUE_STATUSES = ['OPEN','UNDER_REVIEW','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED','REJECTED'];
export const CLOSED_STATUSES = ['CLOSED', 'REJECTED'];
export const PUBLIC_REPORT_SELECT = {
  id:true,title:true,description:true,category:true,priority:true,status:true,stepsToReproduce:true,
  expectedResult:true,actualResult:true,additionalComment:true,currentRoute:true,moduleName:true,
  browser:true,operatingSystem:true,deviceType:true,screenResolution:true,applicationVersion:true,
  screenshotUrl:true,resolutionNote:true,createdAt:true,updatedAt:true,resolvedAt:true,closedAt:true,
};
