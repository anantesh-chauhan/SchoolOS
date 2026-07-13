const normalize = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

const extractDigits = (value) => String(value ?? '').replace(/\D/g, '');

export const getSessionShort = (session) => {
  const compact = String(session ?? '').replace(/-/g, '');
  return compact.slice(-4);
};

export const getAdmissionTail = (admissionNo) => {
  // Keep the complete immutable admission sequence. Truncating this value can
  // create collisions once a school has a large historical student register.
  return extractDigits(admissionNo).padStart(4, '0');
};

export const getSchoolDomain = (schoolCode) => `${normalize(schoolCode)}.schoolos`;

export const formatStudentUserId = ({ firstName, session, admissionNo, schoolCode }) => {
  return `${normalize(firstName) || 'student'}.${getSessionShort(session)}.${getAdmissionTail(admissionNo)}@${getSchoolDomain(schoolCode)}`;
};

export const formatParentUserId = ({ fatherName, studentFirstName, session, admissionNo, schoolCode }) => {
  return `${normalize(fatherName) || 'parent'}.${normalize(studentFirstName) || 'student'}.${getSessionShort(session)}${getAdmissionTail(admissionNo)}@${getSchoolDomain(schoolCode)}`;
};

export const formatTeacherUserId = ({ firstName, lastName, employeeId, joiningYear, schoolCode }) => {
  return `${normalize(firstName)}.${normalize(lastName)}.${normalize(employeeId)}.${String(joiningYear ?? '').slice(0, 4)}@${getSchoolDomain(schoolCode)}`;
};

export const formatStaffUserId = ({ firstName, role, employeeId, schoolCode }) => {
  return `${normalize(firstName)}.${normalize(role)}.${normalize(employeeId)}@${getSchoolDomain(schoolCode)}`;
};

export const generateInitialPassword = (firstName) => `${normalize(firstName)}@123`;

export { normalize };
