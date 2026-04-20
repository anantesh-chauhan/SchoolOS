export const getScopedSchoolId = (user, schoolIdFromRequest = null) => {
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (user.role === 'PLATFORM_OWNER') {
    if (!schoolIdFromRequest) {
      throw new Error('schoolId is required for platform scope');
    }
    return schoolIdFromRequest;
  }

  if (!user.schoolId) {
    throw new Error('User is not mapped to any school');
  }

  return user.schoolId;
};

export const assertPlatformOwner = (user) => {
  if (!user || user.role !== 'PLATFORM_OWNER') {
    throw new Error('Forbidden');
  }
};
