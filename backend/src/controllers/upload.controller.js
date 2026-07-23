import { signCloudinaryParams } from '../utils/cloudinary.util.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { requireSchoolAdminOrAssignedTeacher, sendAuthorizationError } from '../utils/teacherAuthorization.util.js';
import { getHomework, previewAudience } from '../modules/homework/homework.service.js';

const generateTimestamp = () => Math.floor(Date.now() / 1000);

export const getGalleryUploadSignature = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId || req.query.schoolId);
    const groupId = String(req.body.groupId || req.query.groupId || '').trim();

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'groupId is required',
      });
    }

    const timestamp = generateTimestamp();
    const folder = `schoolos/${schoolId}/gallery/${groupId}`;

    const paramsToSign = {
      folder,
      timestamp,
    };

    const signature = signCloudinaryParams(paramsToSign);

    return res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        signature,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSchoolLogoUploadSignature = async (req, res) => {
  try {
    const schoolId = req.body.schoolId || req.query.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'schoolId is required',
      });
    }

    const timestamp = generateTimestamp();
    const folder = `schoolos/${schoolId}/branding`;

    const paramsToSign = {
      folder,
      timestamp,
      public_id: 'school-logo',
      overwrite: 'true',
      invalidate: 'true',
    };

    const signature = signCloudinaryParams(paramsToSign);

    return res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        publicId: 'school-logo',
        overwrite: true,
        invalidate: true,
        signature,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate logo upload signature',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSectionResourceUploadSignature = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId || req.query.schoolId);
    const classId = String(req.body.classId || '').trim();
    const sectionId = String(req.body.sectionId || '').trim();
    const subjectId = String(req.body.subjectId || '').trim();

    if (!classId || !sectionId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: 'classId, sectionId and subjectId are required',
      });
    }

    if (req.user.role !== 'CURRICULUM_MANAGER') await requireSchoolAdminOrAssignedTeacher(req.user, { schoolId, classId, sectionId, subjectId });

    const timestamp = generateTimestamp();
    const folder = `schoolos/${schoolId}/resources/${classId}/${sectionId}/${subjectId}`;
    const paramsToSign = { folder, timestamp };
    const signature = signCloudinaryParams(paramsToSign);

    return res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        signature,
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({
      success: false,
      message: 'Failed to generate resource upload signature',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getHomeworkUploadSignature = async (req, res) => {
  try {
    const homeworkId = String(req.body.homeworkId || '').trim();
    if (!homeworkId) return res.status(400).json({ success: false, message: 'homeworkId is required' });
    const homework = await getHomework(req.user, homeworkId, req.body.studentId);
    if (req.user.role === 'PARENT') return res.status(403).json({ success: false, message: 'Parents cannot upload homework submissions' });
    const timestamp = generateTimestamp();
    const purpose = req.user.role === 'STUDENT' ? 'submissions' : 'content';
    const folder = `schoolos/${req.user.schoolId}/homework/${homework.id}/${purpose}`;
    const paramsToSign = { folder, timestamp };
    return res.json({ success: true, data: { cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature: signCloudinaryParams(paramsToSign) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to generate homework upload signature', ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {}) });
  }
};

export const getAcademicContentUploadSignature = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    await previewAudience(req.user, req.body);
    const timestamp = generateTimestamp();
    const folder = `schoolos/${schoolId}/academic-content/${req.user.id}/${timestamp}`;
    const paramsToSign = { folder, timestamp };
    return res.json({ success: true, data: { cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, timestamp, folder, signature: signCloudinaryParams(paramsToSign) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to generate academic content upload signature' });
  }
};

export const getIssueScreenshotUploadSignature = async (req, res) => {
  try {
    const timestamp = generateTimestamp();
    const folder = `schoolos/${req.user.schoolId || 'platform'}/issue-reports/${req.user.id}`;
    const paramsToSign = { folder, timestamp };
    return res.json({ success:true, data:{ cloudName:process.env.CLOUDINARY_CLOUD_NAME, apiKey:process.env.CLOUDINARY_API_KEY, timestamp, folder, signature:signCloudinaryParams(paramsToSign) } });
  } catch (error) { return res.status(503).json({ success:false, message:'Screenshot upload is currently unavailable' }); }
};
