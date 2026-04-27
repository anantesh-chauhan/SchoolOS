import { signCloudinaryParams } from '../utils/cloudinary.util.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';

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
